import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico AES-256-GCM para secretos de clientes guardados en la BD
 * (tokens de WhatsApp, credenciales de CRM). Formato: v1.<iv>.<tag>.<ciphertext> en base64url.
 *
 * El "aad" ata el ciphertext a su dueño (p. ej. "tenant:<id>"): copiar el valor
 * cifrado a la fila de otro tenant hace que el descifrado falle.
 */
export class SecretBox {
  private key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("La clave de SecretBox debe ser de 32 bytes en base64");
  }

  static generateKey(): string {
    return randomBytes(32).toString("base64");
  }

  seal(plaintext: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
  }

  open(sealed: string, aad: string): string {
    const [version, iv, tag, ct] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || !ct) throw new Error("Secreto cifrado con formato inválido");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
  }
}
