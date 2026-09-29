import { timingSafeEqual } from "node:crypto";
import type { Principal, SecretBox } from "@pronex/auth";
import { parseWhatsAppWebhook, verifyWhatsAppSignature, type WhatsAppClient } from "@pronex/channels";
import { withTenant } from "@pronex/db";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { HttpError } from "../auth.js";
import {
  applyStatus, credentialsAad, dispatchInbound, ingestInbound, sendMessage, type InboundDispatcher,
} from "@pronex/messaging";

export interface ChannelDeps {
  secretBox: SecretBox;
  dispatcher: InboundDispatcher;
  whatsapp: {
    client: WhatsAppClient;
    /** App Secret de la app de Meta: firma los webhooks. */
    appSecret: string;
    /** Token elegido por nosotros para el handshake GET de suscripción. */
    verifyToken: string;
  };
}

type Audit = (c: PoolClient, p: Principal, action: string, target: string | null, detail?: object) => Promise<void>;

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const templateSchema = {
  type: "object", required: ["name", "language"], additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 512 },
    language: { type: "string", minLength: 2, maxLength: 15 },
    components: { type: "array", maxItems: 20 },
  },
} as const;

export function registerChannelRoutes(app: FastifyInstance, pool: Pool, deps: ChannelDeps, audit: Audit) {
  // --- Webhook de WhatsApp (público, autenticado por firma) --------------------

  app.register(async (scope) => {
    // Cuerpo crudo: la firma se calcula sobre los bytes exactos que envió Meta.
    scope.removeContentTypeParser("application/json");
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

    scope.get<{ Querystring: Record<string, string> }>("/webhooks/whatsapp", async (req, reply) => {
      const q = req.query;
      if (q["hub.mode"] === "subscribe" && typeof q["hub.verify_token"] === "string"
        && safeEqual(q["hub.verify_token"], deps.whatsapp.verifyToken)) {
        return reply.type("text/plain").send(q["hub.challenge"] ?? "");
      }
      return reply.status(403).send({ error: "forbidden" });
    });

    scope.post("/webhooks/whatsapp", async (req, reply) => {
      const raw = req.body as Buffer;
      if (!Buffer.isBuffer(raw) || !verifyWhatsAppSignature(raw, req.headers["x-hub-signature-256"] as string | undefined, deps.whatsapp.appSecret)) {
        return reply.status(401).send({ error: "invalid_signature" });
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        return reply.status(400).send({ error: "invalid_json" });
      }

      const parsed = parseWhatsAppWebhook(body);
      const summary = { stored: 0, duplicate: 0, unknown_account: 0, statuses: 0 };
      // Errores de BD suben como 500 → Meta reintenta, y la idempotencia hace seguro el reintento.
      for (const msg of parsed.messages) {
        const r = await ingestInbound(pool, msg);
        summary[r.status]++;
        if (r.status === "stored") await dispatchInbound(pool, deps.dispatcher, r.event);
        else if (r.status === "unknown_account") req.log.warn({ account: msg.accountExternalId }, "webhook de número no conectado");
      }
      for (const s of parsed.statuses) if (await applyStatus(pool, s)) summary.statuses++;
      return reply.send(summary);
    });
  });

  // --- Conexión de números -----------------------------------------------------

  app.post<{ Body: { workspaceId: string; phoneNumberId: string; accessToken: string; displayName?: string } }>(
    "/v1/channels/whatsapp", {
      config: { permission: "channels:manage" },
      schema: {
        body: {
          type: "object", required: ["workspaceId", "phoneNumberId", "accessToken"], additionalProperties: false,
          properties: {
            workspaceId: { type: "string", format: "uuid" },
            phoneNumberId: { type: "string", pattern: "^[0-9]{5,30}$" },
            accessToken: { type: "string", minLength: 20, maxLength: 1024 },
            displayName: { type: "string", maxLength: 100 },
          },
        },
      },
    }, async (req, reply) => {
      const p = req.principal!;
      const b = req.body;
      const sealed = deps.secretBox.seal(b.accessToken, credentialsAad(p.tenantId));
      const row = await withTenant(pool, p.tenantId, async (c) => {
        const ws = await c.query("select 1 from workspaces where id = $1", [b.workspaceId]);
        if (!ws.rowCount) throw new HttpError(404, "workspace_not_found");
        const inserted = await c.query(
          `insert into channel_accounts (tenant_id, workspace_id, channel, external_id, display_name, credentials_enc)
           values ($1, $2, 'whatsapp', $3, $4, $5)
           on conflict (channel, external_id) do nothing
           returning id, workspace_id, channel, external_id, display_name, active, created_at`,
          [p.tenantId, b.workspaceId, b.phoneNumberId, b.displayName ?? null, sealed],
        );
        // Mismo error si el número es de otro tenant o de este: no revela a quién pertenece.
        if (!inserted.rowCount) throw new HttpError(409, "channel_already_connected");
        await audit(c, p, "channel.connect", inserted.rows[0].id, { channel: "whatsapp", externalId: b.phoneNumberId });
        return inserted.rows[0];
      });
      return reply.status(201).send(row);
    });

  // --- Bandeja de conversaciones ----------------------------------------------

  app.get("/v1/conversations", { config: { permission: "conversations:read" } }, async (req) => {
    const { rows } = await withTenant(pool, req.principal!.tenantId, (c) =>
      c.query(
        `select c.id, c.channel, c.owner, c.status, c.last_inbound_at, c.created_at,
                l.id as lead_id, l.full_name as lead_name, l.phone as lead_phone
         from conversations c join leads l on l.tenant_id = c.tenant_id and l.id = c.lead_id
         order by c.last_inbound_at desc nulls last limit 50`,
      ),
    );
    return { data: rows };
  });

  app.get<{ Params: { id: string } }>("/v1/conversations/:id/messages", {
    config: { permission: "conversations:read" },
    schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
  }, async (req) => {
    const { rows } = await withTenant(pool, req.principal!.tenantId, (c) =>
      c.query(
        `select id, direction, sender, body, status, created_at from messages
         where conversation_id = $1 order by created_at, id`,
        [req.params.id],
      ),
    );
    return { data: rows };
  });

  app.post<{ Params: { id: string }; Body: { text?: string; template?: { name: string; language: string; components?: unknown[] } } }>(
    "/v1/conversations/:id/messages", {
      config: { permission: "conversations:write" },
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", additionalProperties: false,
          properties: { text: { type: "string", minLength: 1, maxLength: 4096 }, template: templateSchema },
          oneOf: [{ required: ["text"] }, { required: ["template"] }],
        },
      },
    }, async (req, reply) => {
      const p = req.principal!;
      const content = req.body.text !== undefined ? { text: req.body.text } : { template: req.body.template! };
      const msg = await sendMessage({ pool, secretBox: deps.secretBox, whatsapp: deps.whatsapp.client }, {
        tenantId: p.tenantId, conversationId: req.params.id, sender: "human", content,
      });
      return reply.status(201).send(msg);
    });

  /** Devuelve la conversación al agente (libera el lock de handoff). */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/release", {
    config: { permission: "conversations:write" },
    schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
  }, async (req, reply) => {
    const p = req.principal!;
    const updated = await withTenant(pool, p.tenantId, async (c) => {
      const r = await c.query("update conversations set owner = 'agent' where id = $1 returning id", [req.params.id]);
      if (r.rowCount) await audit(c, p, "conversation.release", req.params.id);
      return r.rowCount;
    });
    if (!updated) throw new HttpError(404, "not_found");
    return reply.status(204).send();
  });
}
