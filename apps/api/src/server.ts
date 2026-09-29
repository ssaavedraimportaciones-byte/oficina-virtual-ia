import { createOidcVerifier } from "@pronex/auth";
import pg from "pg";
import { buildApp } from "./app.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

const pool = new pg.Pool({ connectionString: required("APP_DATABASE_URL"), max: 20 });
const verifyOidc = createOidcVerifier({ issuer: required("OIDC_ISSUER"), audience: required("OIDC_AUDIENCE") });
const app = buildApp({ pool, verifyOidc, logger: true });

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
