import type { InboundMessage, StatusUpdate } from "@pronex/channels";
import { withTenant } from "@pronex/db";
import type { Pool } from "pg";

export interface InboundEvent {
  tenantId: string;
  conversationId: string;
  messageId: string;
}

/**
 * Entrega un mensaje nuevo al runtime del agente. En el paso 4 esto arranca o
 * señaliza el workflow de Temporal de la conversación (id = conversationId).
 */
export interface InboundDispatcher {
  dispatch(event: InboundEvent): Promise<void>;
}

export type IngestResult =
  | { status: "stored"; event: InboundEvent }
  | { status: "duplicate" }
  | { status: "unknown_account" };

/**
 * Guarda un mensaje entrante de forma idempotente: upsert del lead por teléfono,
 * upsert de la conversación abierta y alta del mensaje con ON CONFLICT sobre el
 * id del proveedor. Si el webhook llega dos veces, la segunda es "duplicate" y
 * no dispara otra respuesta del agente.
 */
export async function ingestInbound(pool: Pool, msg: InboundMessage): Promise<IngestResult> {
  const { rows: [account] } = await pool.query<{ id: string; tenant_id: string; workspace_id: string; agent_id: string | null }>(
    "select * from app.resolve_channel_account($1, $2)", [msg.channel, msg.accountExternalId],
  );
  if (!account) return { status: "unknown_account" };

  return withTenant(pool, account.tenant_id, async (c) => {
    const lead = await c.query<{ id: string }>(
      `insert into leads (tenant_id, workspace_id, full_name, phone) values ($1, $2, $3, $4)
       on conflict (tenant_id, workspace_id, phone) where phone is not null
       do update set full_name = coalesce(leads.full_name, excluded.full_name)
       returning id`,
      [account.tenant_id, account.workspace_id, msg.contactName, msg.from],
    );
    const conv = await c.query<{ id: string }>(
      `insert into conversations (tenant_id, lead_id, channel, channel_account_id, last_inbound_at, agent_id)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (tenant_id, lead_id, channel_account_id) where status = 'open'
       do update set last_inbound_at = greatest(conversations.last_inbound_at, excluded.last_inbound_at)
       returning id`,
      [account.tenant_id, lead.rows[0]!.id, msg.channel, account.id, msg.timestamp, account.agent_id],
    );
    const conversationId = conv.rows[0]!.id;
    const inserted = await c.query<{ id: string }>(
      `insert into messages (tenant_id, conversation_id, direction, channel, provider_msg_id, body, sender, payload)
       values ($1, $2, 'inbound', $3, $4, $5, 'lead', $6)
       on conflict (tenant_id, channel, provider_msg_id) do nothing
       returning id`,
      [account.tenant_id, conversationId, msg.channel, msg.providerMessageId, msg.text,
        { type: msg.type, sentAt: msg.timestamp.toISOString(), raw: msg.raw }],
    );
    if (!inserted.rowCount) return { status: "duplicate" } as const;
    return {
      status: "stored",
      event: { tenantId: account.tenant_id, conversationId, messageId: inserted.rows[0]!.id },
    } as const;
  });
}

/** Marca el mensaje como entregado al runtime (outbox). Si falla, lo recoge el barrido. */
export async function dispatchInbound(pool: Pool, dispatcher: InboundDispatcher, event: InboundEvent): Promise<boolean> {
  try {
    await dispatcher.dispatch(event);
  } catch {
    return false;
  }
  await withTenant(pool, event.tenantId, (c) =>
    c.query("update messages set dispatched_at = now() where id = $1", [event.messageId]),
  );
  return true;
}

/** Reintenta despachar inbound que quedaron pendientes (dispatcher caído, proceso reiniciado). */
export async function sweepPendingInbound(pool: Pool, dispatcher: InboundDispatcher, olderThanSeconds = 30, limit = 100) {
  const { rows } = await pool.query<{ tenant_id: string; conversation_id: string; message_id: string }>(
    "select * from app.pending_inbound(make_interval(secs => $1), $2)", [olderThanSeconds, limit],
  );
  let dispatched = 0;
  for (const r of rows) {
    const ok = await dispatchInbound(pool, dispatcher, {
      tenantId: r.tenant_id, conversationId: r.conversation_id, messageId: r.message_id,
    });
    if (ok) dispatched++;
  }
  return { pending: rows.length, dispatched };
}

/** Aplica un estado de entrega sin retroceder (read no vuelve a delivered). */
export async function applyStatus(pool: Pool, s: StatusUpdate): Promise<boolean> {
  const { rows: [account] } = await pool.query<{ tenant_id: string }>(
    "select * from app.resolve_channel_account($1, $2)", [s.channel, s.accountExternalId],
  );
  if (!account) return false;
  const r = await withTenant(pool, account.tenant_id, (c) =>
    c.query(
      `update messages set status = $3, error = $4
       where channel = $1 and provider_msg_id = $2 and direction = 'outbound'
         and coalesce(array_position(array['queued','sent','delivered','read','failed'], status), 0)
             < array_position(array['queued','sent','delivered','read','failed'], $3::text)`,
      [s.channel, s.providerMessageId, s.status, s.error],
    ),
  );
  return (r.rowCount ?? 0) > 0;
}
