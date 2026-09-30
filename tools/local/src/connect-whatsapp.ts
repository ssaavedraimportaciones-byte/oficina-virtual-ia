/**
 * pnpm local:whatsapp -- --phone-number-id 1234567890 --token EAAG... [--name "Ventas"]
 *
 * Conecta un número real de WhatsApp Business al agente de ejemplo. (En
 * producción esto se hace con POST /v1/channels/whatsapp y un usuario owner/admin;
 * en local se hace directo porque no hay proveedor de login configurado.)
 */
import { parseArgs } from "node:util";
import { SecretBox } from "@pronex/auth";
import { withTenant } from "@pronex/db";
import pg from "pg";
import { loadEnv, need, readState } from "./env.js";

const { values } = parseArgs({
  options: {
    "phone-number-id": { type: "string" },
    token: { type: "string" },
    name: { type: "string", default: "WhatsApp real" },
  },
});

loadEnv();
const phoneNumberId = values["phone-number-id"];
const token = values.token;
if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId) || !token || token.length < 20) {
  console.error('Uso: pnpm local:whatsapp -- --phone-number-id <Phone number ID> --token <token de acceso> [--name "Ventas"]');
  process.exit(1);
}
if (process.env.META_GRAPH_BASE_URL) {
  console.warn("⚠  META_GRAPH_BASE_URL sigue definida en .env: los mensajes irán al simulador, no a Meta. Bórrala y reinicia pnpm local:dev.");
}

const s = readState();
const box = new SecretBox(need("PRONEX_SECRET_KEY"));
const pool = new pg.Pool({ connectionString: need("APP_DATABASE_URL") });
try {
  const row = await withTenant(pool, s.tenantId, async (c) => {
    const r = await c.query(
      `insert into channel_accounts (tenant_id, workspace_id, channel, external_id, display_name, credentials_enc, agent_id)
       values ($1, $2, 'whatsapp', $3, $4, $5, $6)
       on conflict (channel, external_id) do nothing returning id`,
      [s.tenantId, s.workspaceId, phoneNumberId, values.name, box.seal(token, `channel_account:${s.tenantId}`), s.agentId],
    );
    if (!r.rowCount) throw new Error("Ese número ya está conectado.");
    await c.query(
      "insert into audit_log (tenant_id, actor, action, target, detail) values ($1, 'local:whatsapp', 'channel.connect', $2, $3)",
      [s.tenantId, r.rows[0].id, { channel: "whatsapp", externalId: phoneNumberId }],
    );
    return r.rows[0];
  });
  console.log(`✔ Número ${phoneNumberId} conectado al agente de ejemplo (canal ${row.id}).`);
  console.log("  Recuerda registrar el webhook en Meta apuntando a tu túnel: https://<tu-tunel>/webhooks/whatsapp");
} catch (err) {
  console.error(`✖ ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
