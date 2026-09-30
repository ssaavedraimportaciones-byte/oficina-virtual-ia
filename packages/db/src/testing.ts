import pg from "pg";
import { migrate } from "./migrate.js";

export const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/pronex_test";
const APP_PASSWORD = process.env.PRONEX_APP_PASSWORD ?? "pronex_app_test";

/** Base de datos limpia + migraciones + rol de app con login. Devuelve un pool como pronex_app. */
export async function freshDatabase(): Promise<{ admin: pg.Client; app: pg.Pool }> {
  // Los tests BORRAN el esquema: solo se permite sobre una base cuyo nombre contenga "test".
  const dbName = new URL(ADMIN_URL).pathname.slice(1);
  if (!/test/i.test(dbName)) {
    throw new Error(`Los tests borran la base "${dbName}". Usa una base de pruebas (su nombre debe contener "test").`);
  }
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`
    drop schema if exists public cascade;
    drop schema if exists app cascade;
    create schema public;
  `);
  await migrate(ADMIN_URL);
  await admin.query(`alter role pronex_app login password '${APP_PASSWORD}'`);

  const url = new URL(ADMIN_URL);
  url.username = "pronex_app";
  url.password = APP_PASSWORD;
  const app = new pg.Pool({ connectionString: url.toString(), max: 4 });
  return { admin, app };
}
