import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

/** Raíz del repositorio (los scripts se ejecutan desde tools/local). */
export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const ENV_FILE = `${ROOT}.env`;
export const STATE_FILE = `${ROOT}.pronex-local.json`;

const secret = (bytes = 24) => randomBytes(bytes).toString("base64url");

/** Crea .env con secretos generados si no existe. Devuelve true si lo creó. */
export function ensureEnvFile(): boolean {
  if (existsSync(ENV_FILE)) return false;
  const appPassword = secret(18);
  writeFileSync(ENV_FILE, `# Pronex · entorno local (generado por "pnpm local:setup"). No lo subas a git.

# --- Obligatorio: tu clave de la API de Anthropic (https://console.anthropic.com) ---
ANTHROPIC_API_KEY=

# --- Servicios de docker-compose.yml ---
DATABASE_URL=postgres://postgres:postgres@localhost:55432/pronex
APP_DATABASE_URL=postgres://pronex_app:${appPassword}@localhost:55432/pronex
PRONEX_APP_PASSWORD=${appPassword}
REDIS_URL=redis://localhost:56379
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# --- API ---
PORT=3000
# Login de personas por OIDC (Auth0, Clerk, Keycloak…). En local se usa la API key del setup.
OIDC_ISSUER=https://example.invalid/
OIDC_AUDIENCE=pronex-api

# --- Secretos (generados) ---
PRONEX_SECRET_KEY=${randomBytes(32).toString("base64")}
META_APP_SECRET=${secret()}
WHATSAPP_VERIFY_TOKEN=${secret(12)}

# --- WhatsApp ---
# Con esta línea, los mensajes salientes van al simulador ("pnpm local:chat").
# Para WhatsApp real: bórrala, pon el App Secret real de Meta en META_APP_SECRET
# y conecta tu número con "pnpm local:whatsapp".
META_GRAPH_BASE_URL=http://localhost:4010
`);
  return true;
}

/**
 * Carga .env y, a diferencia de process.loadEnvFile, sus valores MANDAN sobre las
 * variables ya definidas en la terminal: el archivo es la configuración del proyecto.
 * Avisa cuando pisa una variable existente distinta (causa típica de "clave inválida").
 */
export function loadEnv(): void {
  if (!existsSync(ENV_FILE)) throw new Error('Falta .env. Ejecuta primero: pnpm local:setup');
  const values = parseEnv(readFileSync(ENV_FILE, "utf8"));
  for (const [k, v] of Object.entries(values)) {
    if (process.env[k] !== undefined && process.env[k] !== v && v !== "" && !warned.has(k)) {
      warned.add(k);
      console.warn(`(i) ${k} de .env reemplaza el valor que tenía tu terminal.`);
    }
    if (v !== "" || process.env[k] === undefined) process.env[k] = v;
  }
}
const warned = new Set<string>();

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en .env`);
  return v;
}

export interface LocalState {
  tenantId: string;
  workspaceId: string;
  agentId: string;
  channelAccountId: string;
  phoneNumberId: string;
  apiKey: string;
}

export function readState(): LocalState {
  if (!existsSync(STATE_FILE)) throw new Error('No hay datos de ejemplo. Ejecuta primero: pnpm local:setup');
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as LocalState;
}

export function writeState(state: LocalState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}
