/**
 * Arranque de la base en cada despliegue (pre-deploy):
 *  1. aplica migraciones pendientes con el rol dueño (DATABASE_URL);
 *  2. habilita el rol de la app (pronex_app) con PRONEX_APP_PASSWORD.
 * Es idempotente: correrlo de nuevo no cambia nada.
 */
import pg from "pg";
import { migrate } from "./migrate.js";

const url = process.env.DATABASE_URL;
const appPassword = process.env.PRONEX_APP_PASSWORD;
if (!url) throw new Error("Falta DATABASE_URL (rol dueño de la base)");
if (!appPassword || appPassword.length < 16) throw new Error("Falta PRONEX_APP_PASSWORD (mínimo 16 caracteres)");

const applied = await migrate(url);
console.log(applied.length ? `Migraciones aplicadas: ${applied.join(", ")}` : "Base de datos al día");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`alter role pronex_app login password '${appPassword.replace(/'/g, "''")}'`);
  console.log("Rol pronex_app habilitado");
} finally {
  await client.end();
}
