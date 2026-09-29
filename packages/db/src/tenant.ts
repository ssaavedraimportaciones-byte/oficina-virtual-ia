import type { Pool, PoolClient } from "pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantContextError extends Error {}

/**
 * Ejecuta `fn` dentro de una transacción con el tenant fijado vía SET LOCAL.
 *
 * Es la única forma permitida de tocar tablas de negocio: HTTP, workers de
 * Temporal y jobs en background pasan todos por aquí, así RLS aplica igual
 * en cada camino. El valor muere con la transacción, por lo que una conexión
 * devuelta al pool nunca arrastra el tenant anterior.
 */
export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new TenantContextError(`tenant_id inválido: ${JSON.stringify(tenantId)}`);
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
