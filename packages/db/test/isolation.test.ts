import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TenantContextError, withTenant } from "../src/tenant.js";
import { freshDatabase } from "./helpers.js";

let admin: pg.Client;
let app: pg.Pool;

type Seed = { tenant: string; workspace: string; lead: string; conversation: string };
let A: Seed;
let B: Seed;

async function seedTenant(name: string): Promise<Seed> {
  const tenant = randomUUID();
  return withTenant(app, tenant, async (c) => {
    await c.query("insert into tenants (id, name) values ($1, $2)", [tenant, name]);
    const ws = await c.query("insert into workspaces (tenant_id, name) values ($1, 'main') returning id", [tenant]);
    const workspace = ws.rows[0].id;
    const ld = await c.query(
      "insert into leads (tenant_id, workspace_id, full_name, phone) values ($1, $2, $3, '+56900000000') returning id",
      [tenant, workspace, `Lead de ${name}`],
    );
    const lead = ld.rows[0].id;
    const cv = await c.query(
      "insert into conversations (tenant_id, lead_id, channel) values ($1, $2, 'whatsapp') returning id",
      [tenant, lead],
    );
    return { tenant, workspace, lead, conversation: cv.rows[0].id };
  });
}

beforeAll(async () => {
  ({ admin, app } = await freshDatabase());
  A = await seedTenant("A");
  B = await seedTenant("B");
});

afterAll(async () => {
  await app?.end();
  await admin?.end();
});

describe("aislamiento entre tenants (RLS)", () => {
  it("cada tenant solo ve sus propias filas", async () => {
    const leads = await withTenant(app, A.tenant, (c) => c.query("select id from leads"));
    expect(leads.rows.map((r) => r.id)).toEqual([A.lead]);

    const tenants = await withTenant(app, A.tenant, (c) => c.query("select id from tenants"));
    expect(tenants.rows.map((r) => r.id)).toEqual([A.tenant]);
  });

  it("buscar por id una fila de otro tenant devuelve vacío", async () => {
    const r = await withTenant(app, A.tenant, (c) => c.query("select * from leads where id = $1", [B.lead]));
    expect(r.rowCount).toBe(0);
  });

  it("sin tenant fijado no se ve nada (fail-closed)", async () => {
    const c = await app.connect();
    try {
      const r = await c.query("select count(*)::int as n from leads");
      expect(r.rows[0].n).toBe(0);
    } finally {
      c.release();
    }
  });

  it("sin tenant fijado no se puede escribir", async () => {
    const c = await app.connect();
    try {
      await expect(
        c.query("insert into workspaces (tenant_id, name) values ($1, 'x')", [A.tenant]),
      ).rejects.toThrow(/row-level security/);
    } finally {
      c.release();
    }
  });

  it("no se puede insertar con tenant_id de otro tenant", async () => {
    await expect(
      withTenant(app, A.tenant, (c) =>
        c.query("insert into workspaces (tenant_id, name) values ($1, 'intruso')", [B.tenant]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("UPDATE y DELETE sobre filas de otro tenant no afectan nada", async () => {
    const upd = await withTenant(app, A.tenant, (c) =>
      c.query("update leads set full_name = 'hackeado' where id = $1", [B.lead]),
    );
    const del = await withTenant(app, A.tenant, (c) => c.query("delete from leads where id = $1", [B.lead]));
    expect(upd.rowCount).toBe(0);
    expect(del.rowCount).toBe(0);

    const still = await withTenant(app, B.tenant, (c) => c.query("select full_name from leads"));
    expect(still.rows[0].full_name).toBe("Lead de B");
  });

  it("no se puede mover una fila propia a otro tenant", async () => {
    await expect(
      withTenant(app, A.tenant, (c) => c.query("update leads set tenant_id = $1 where id = $2", [B.tenant, A.lead])),
    ).rejects.toThrow();
  });

  it("FK compuesta: una conversación de A no puede apuntar a un lead de B", async () => {
    await expect(
      withTenant(app, A.tenant, (c) =>
        c.query("insert into conversations (tenant_id, lead_id, channel) values ($1, $2, 'sms')", [A.tenant, B.lead]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("el tenant no queda pegado en la conexión después de la transacción", async () => {
    await withTenant(app, A.tenant, (c) => c.query("select 1"));
    const clients = await Promise.all([app.connect(), app.connect(), app.connect(), app.connect()]);
    try {
      for (const c of clients) {
        const r = await c.query("select app.current_tenant() as t");
        expect(r.rows[0].t).toBeNull();
      }
    } finally {
      clients.forEach((c) => c.release());
    }
  });

  it("withTenant rechaza ids que no son UUID", async () => {
    await expect(withTenant(app, "' or 1=1 --", async () => null)).rejects.toBeInstanceOf(TenantContextError);
    await expect(withTenant(app, "", async () => null)).rejects.toBeInstanceOf(TenantContextError);
  });
});

describe("idempotencia de webhooks", () => {
  it("el mismo provider_msg_id se guarda una sola vez", async () => {
    const insert = (c: pg.PoolClient) =>
      c.query(
        `insert into messages (tenant_id, conversation_id, direction, channel, provider_msg_id, body)
         values ($1, $2, 'inbound', 'whatsapp', 'wamid.123', 'hola')
         on conflict (tenant_id, channel, provider_msg_id) do nothing`,
        [A.tenant, A.conversation],
      );
    const first = await withTenant(app, A.tenant, insert);
    const second = await withTenant(app, A.tenant, insert);
    expect(first.rowCount).toBe(1);
    expect(second.rowCount).toBe(0);
  });
});

describe("audit_log append-only", () => {
  it("permite insertar y leer, pero no modificar ni borrar", async () => {
    await withTenant(app, A.tenant, (c) =>
      c.query("insert into audit_log (tenant_id, actor, action) values ($1, 'test', 'lead.create')", [A.tenant]),
    );
    await expect(
      withTenant(app, A.tenant, (c) => c.query("update audit_log set action = 'x'")),
    ).rejects.toThrow(/permission denied|append-only/);
    await expect(withTenant(app, A.tenant, (c) => c.query("delete from audit_log"))).rejects.toThrow(
      /permission denied|append-only/,
    );
    // Ni siquiera el dueño puede reescribir la historia.
    await expect(admin.query("delete from audit_log")).rejects.toThrow(/append-only/);
  });
});

describe("salvaguardas del esquema", () => {
  it("el rol de la app no es superusuario, no tiene BYPASSRLS y no es dueño de tablas", async () => {
    const role = await admin.query("select rolsuper, rolbypassrls from pg_roles where rolname = 'pronex_app'");
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const owned = await admin.query(
      "select count(*)::int as n from pg_tables where schemaname = 'public' and tableowner = 'pronex_app'",
    );
    expect(owned.rows[0].n).toBe(0);
  });

  it("toda tabla con tenant_id tiene RLS habilitado y forzado con política", async () => {
    // Guardián para tablas futuras: si alguien olvida RLS en una migración nueva, esto falla.
    const r = await admin.query(`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity,
             exists (select 1 from pg_policies p where p.tablename = c.relname) as has_policy
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where c.relkind = 'r'
        and (exists (select 1 from information_schema.columns col
                     where col.table_schema = 'public' and col.table_name = c.relname
                       and col.column_name = 'tenant_id')
             or c.relname = 'tenants')`);
    expect(r.rowCount).toBeGreaterThan(5);
    const unprotected = r.rows.filter((t) => !t.relrowsecurity || !t.relforcerowsecurity || !t.has_policy);
    expect(unprotected.map((t) => t.relname)).toEqual([]);
  });
});
