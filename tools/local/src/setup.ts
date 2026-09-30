/**
 * pnpm local:setup
 *  1. Crea .env con secretos (si no existe).
 *  2. Espera a Postgres, aplica migraciones y habilita el rol de la app.
 *  3. Crea datos de ejemplo: empresa, agente publicado, número simulado,
 *     casos dorados y una API key. Es idempotente.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { generateApiKey, SecretBox } from "@pronex/auth";
import { migrate, withTenant } from "@pronex/db";
import pg from "pg";
import { DEMO_AGENT_NAME, DEMO_GOLDEN_CASES, DEMO_PROMPT } from "@pronex/agent";
import { ensureEnvFile, loadEnv, need, readState, STATE_FILE, writeState } from "./env.js";

const API_KEY_SCOPES = [
  "leads:read", "leads:write", "conversations:read", "conversations:write",
  "agents:read", "agents:write", "agents:publish", "analytics:read",
];

async function waitForPostgres(url: string) {
  for (let i = 0; i < 60; i++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.end();
      return;
    } catch {
      await c.end().catch(() => {});
      if (i === 0) console.log("Esperando a Postgres (¿corriste \"docker compose up -d\"?)…");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Postgres no responde. Revisa \"docker compose ps\".");
}

async function main() {
  if (ensureEnvFile()) console.log("✔ Creé .env con secretos nuevos.");
  loadEnv();
  const adminUrl = need("DATABASE_URL");

  await waitForPostgres(adminUrl);
  const applied = await migrate(adminUrl);
  console.log(applied.length ? `✔ Migraciones aplicadas: ${applied.join(", ")}` : "✔ Base de datos al día.");

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const password = need("PRONEX_APP_PASSWORD").replace(/'/g, "''");
  await admin.query(`alter role pronex_app login password '${password}'`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: need("APP_DATABASE_URL") });
  try {
    if (existsSync(STATE_FILE)) {
      const s = readState();
      const { rows } = await withTenant(pool, s.tenantId, (c) => c.query("select 1 from tenants where id = $1", [s.tenantId]));
      if (rows.length) {
        printSummary(s, false);
        return;
      }
      console.log("El archivo .pronex-local.json apunta a datos que ya no existen: los vuelvo a crear.");
    }
    printSummary(await seed(pool), true);
  } finally {
    await pool.end();
  }
}

async function seed(pool: pg.Pool) {
  const tenantId = randomUUID();
  // Número simulado distinto por instalación (el phone_number_id es único en todo el sistema).
  const phoneNumberId = `9${Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("")}`;
  const box = new SecretBox(need("PRONEX_SECRET_KEY"));
  const key = generateApiKey();

  const state = await withTenant(pool, tenantId, async (c) => {
    await c.query("insert into tenants (id, name) values ($1, 'Clínica Sonrisa (demo)')", [tenantId]);
    const workspaceId = (await c.query("insert into workspaces (tenant_id, name) values ($1, 'Principal') returning id", [tenantId])).rows[0].id;
    const agentId = (await c.query(
      "insert into agents (tenant_id, workspace_id, name) values ($1, $2, $3) returning id", [tenantId, workspaceId, DEMO_AGENT_NAME],
    )).rows[0].id;
    const versionId = (await c.query(
      `insert into agent_versions (tenant_id, agent_id, version, prompt, model, tools, notes, created_by)
       values ($1, $2, 1, $3, 'claude-opus-5-5', '["handoff_to_human","update_lead"]', 'versión inicial de ejemplo', 'local:setup')
       returning id`,
      [tenantId, agentId, DEMO_PROMPT],
    )).rows[0].id;
    await c.query("update agents set published_version_id = $2 where id = $1", [agentId, versionId]);
    for (const gc of DEMO_GOLDEN_CASES) {
      await c.query(
        "insert into golden_cases (tenant_id, agent_id, name, turns, expectations) values ($1, $2, $3, $4, $5)",
        [tenantId, agentId, gc.name, JSON.stringify(gc.turns), gc.expectations],
      );
    }
    const channelAccountId = (await c.query(
      `insert into channel_accounts (tenant_id, workspace_id, channel, external_id, display_name, credentials_enc, agent_id)
       values ($1, $2, 'whatsapp', $3, 'Simulador local', $4, $5) returning id`,
      [tenantId, workspaceId, phoneNumberId, box.seal("token-del-simulador", `channel_account:${tenantId}`), agentId],
    )).rows[0].id;
    await c.query(
      `insert into api_keys (tenant_id, name, prefix, secret_hash, scopes, expires_at)
       values ($1, 'local (setup)', $2, $3, $4, now() + interval '365 days')`,
      [tenantId, key.prefix, key.secretHash, API_KEY_SCOPES],
    );
    return { tenantId, workspaceId, agentId, channelAccountId, phoneNumberId, apiKey: key.token };
  });
  writeState(state);
  return state;
}

function printSummary(s: ReturnType<typeof readState>, created: boolean) {
  console.log(created ? "\n✔ Datos de ejemplo creados." : "\n✔ Los datos de ejemplo ya existían.");
  console.log(`
  Empresa (tenant):  ${s.tenantId}
  Workspace:         ${s.workspaceId}
  Agente:            ${s.agentId}
  API key:           ${s.apiKey}
  (guardado en .pronex-local.json)
`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠  Falta ANTHROPIC_API_KEY en .env: agrégala antes de \"pnpm local:dev\".\n");
  }
  console.log("Siguiente:  pnpm local:dev   (en otra terminal)  pnpm local:chat");
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
