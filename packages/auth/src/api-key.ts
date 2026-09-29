import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Formato: pnx_live_<prefix 12>_<secret 32>
 *  - El prefijo identifica la key (se guarda en claro, único) y sirve para
 *    reconocerla en logs y en escáneres de secretos.
 *  - Solo se guarda SHA-256 del secreto. Con 256 bits de entropía no hace falta
 *    un hash lento: fuerza bruta es inviable y la verificación queda barata.
 */
const KEY_RE = /^pnx_live_([A-Za-z0-9]{12})_([A-Za-z0-9_-]{43})$/;

export interface GeneratedApiKey {
  token: string;
  prefix: string;
  secretHash: Buffer;
}

export function generateApiKey(): GeneratedApiKey {
  const prefix = randomBytes(9).toString("base64url").replace(/[-_]/g, "x").slice(0, 12);
  const secret = randomBytes(32).toString("base64url");
  return { token: `pnx_live_${prefix}_${secret}`, prefix, secretHash: hashSecret(secret) };
}

export function parseApiKey(token: string): { prefix: string; secret: string } | null {
  const m = KEY_RE.exec(token);
  return m ? { prefix: m[1]!, secret: m[2]! } : null;
}

export function hashSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function verifySecret(secret: string, expectedHash: Buffer): boolean {
  const actual = hashSecret(secret);
  return actual.length === expectedHash.length && timingSafeEqual(actual, expectedHash);
}

export function looksLikeApiKey(token: string): boolean {
  return token.startsWith("pnx_");
}
