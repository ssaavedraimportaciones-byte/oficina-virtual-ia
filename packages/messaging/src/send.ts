import type { SecretBox } from "@pronex/auth";
import { isWithinServiceWindow, WhatsAppApiError, type TemplateMessage, type WhatsAppClient } from "@pronex/channels";
import { withTenant } from "@pronex/db";
import type { Pool } from "pg";
import { AppError as HttpError } from "./errors.js";

export interface SendDeps {
  pool: Pool;
  secretBox: SecretBox;
  whatsapp: WhatsAppClient;
}

export interface SendRequest {
  tenantId: string;
  conversationId: string;
  sender: "agent" | "human";
  content: { text: string } | { template: TemplateMessage };
}

export const credentialsAad = (tenantId: string) => `channel_account:${tenantId}`;

/**
 * Envía un mensaje saliente en dos fases:
 *  1. Transacción: valida reglas (handoff, ventana 24 h), toma el lock de handoff
 *     si escribe un humano y registra el mensaje como 'queued'.
 *  2. Llamada al proveedor fuera de la transacción (no se retiene una conexión
 *     de BD mientras Meta responde) y actualización a 'sent' o 'failed'.
 */
export async function sendMessage(deps: SendDeps, req: SendRequest) {
  const prepared = await withTenant(deps.pool, req.tenantId, async (c) => {
    const { rows: [conv] } = await c.query<{
      owner: "agent" | "human"; status: string; last_inbound_at: Date | null; channel: string;
      phone: string | null; external_id: string | null; credentials_enc: string | null;
    }>(
      `select c.owner, c.status, c.last_inbound_at, c.channel, l.phone, a.external_id, a.credentials_enc
       from conversations c
       join leads l on l.tenant_id = c.tenant_id and l.id = c.lead_id
       left join channel_accounts a on a.tenant_id = c.tenant_id and a.id = c.channel_account_id
       where c.id = $1
       for update of c`,
      [req.conversationId],
    );
    if (!conv) throw new HttpError(404, "not_found");
    if (conv.status !== "open") throw new HttpError(409, "conversation_closed");
    if (conv.channel !== "whatsapp" || !conv.external_id || !conv.credentials_enc || !conv.phone) {
      throw new HttpError(409, "channel_not_connected");
    }
    // Handoff: si un humano tomó la conversación, el agente no puede responder.
    if (req.sender === "agent" && conv.owner === "human") throw new HttpError(409, "human_owns_conversation");
    if ("text" in req.content && !isWithinServiceWindow(conv.last_inbound_at)) {
      throw new HttpError(409, "outside_service_window");
    }
    if (req.sender === "human" && conv.owner !== "human") {
      await c.query("update conversations set owner = 'human' where id = $1", [req.conversationId]);
    }

    const body = "text" in req.content ? req.content.text : `[plantilla:${req.content.template.name}]`;
    const { rows: [msg] } = await c.query<{ id: string }>(
      `insert into messages (tenant_id, conversation_id, direction, channel, body, sender, status, payload)
       values ($1, $2, 'outbound', 'whatsapp', $3, $4, 'queued', $5) returning id`,
      [req.tenantId, req.conversationId, body, req.sender, "template" in req.content ? { template: req.content.template } : {}],
    );
    return { messageId: msg!.id, phone: conv.phone, phoneNumberId: conv.external_id, credentialsEnc: conv.credentials_enc };
  });

  let providerId: string;
  try {
    providerId = await deps.whatsapp.send({
      phoneNumberId: prepared.phoneNumberId,
      accessToken: deps.secretBox.open(prepared.credentialsEnc, credentialsAad(req.tenantId)),
      to: prepared.phone,
      content: req.content,
    });
  } catch (err) {
    const error = err instanceof WhatsAppApiError
      ? { code: err.code, status: err.status, message: err.message }
      : { code: 0, message: (err as Error).message };
    await withTenant(deps.pool, req.tenantId, (c) =>
      c.query("update messages set status = 'failed', error = $2 where id = $1", [prepared.messageId, error]),
    );
    if (err instanceof WhatsAppApiError && err.isOutsideWindow) throw new HttpError(409, "outside_service_window");
    throw new HttpError(502, "provider_error");
  }

  // Limitación conocida: si el webhook de estado de Meta llegara antes de este UPDATE,
  // no encontraría el mensaje (aún sin provider_msg_id) y ese estado se perdería.
  // En la práctica Meta responde el wamid antes de emitir estados.
  const { rows: [row] } = await withTenant(deps.pool, req.tenantId, (c) =>
    c.query(
      `update messages set provider_msg_id = $2, status = 'sent'
       where id = $1
       returning id, conversation_id, direction, body, sender, status, provider_msg_id, created_at`,
      [prepared.messageId, providerId],
    ),
  );
  return row;
}
