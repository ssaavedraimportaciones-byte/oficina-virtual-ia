import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, UnsecuredJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  can,
  createOidcVerifier,
  generateApiKey,
  InvalidTokenError,
  parseApiKey,
  SecretBox,
  verifySecret,
  type Principal,
} from "../src/index.js";

describe("RBAC", () => {
  const user = (role: "owner" | "admin" | "builder" | "agent" | "viewer"): Principal => ({
    kind: "user", userId: "u", tenantId: "t", role,
  });

  it("viewer lee pero no escribe", () => {
    expect(can(user("viewer"), "leads:read")).toBe(true);
    expect(can(user("viewer"), "leads:write")).toBe(false);
  });

  it("solo owner maneja facturación; admin gestiona keys", () => {
    expect(can(user("owner"), "billing:manage")).toBe(true);
    expect(can(user("admin"), "billing:manage")).toBe(false);
    expect(can(user("admin"), "api_keys:manage")).toBe(true);
    expect(can(user("builder"), "api_keys:manage")).toBe(false);
  });

  it("una API key nunca gestiona keys aunque tenga el scope", () => {
    const key: Principal = {
      kind: "api_key", keyId: "k", tenantId: "t", scopes: new Set(["leads:read", "api_keys:manage"]),
    };
    expect(can(key, "leads:read")).toBe(true);
    expect(can(key, "leads:write")).toBe(false);
    expect(can(key, "api_keys:manage")).toBe(false);
  });
});

describe("API keys", () => {
  it("genera, parsea y verifica", () => {
    const k = generateApiKey();
    const parsed = parseApiKey(k.token);
    expect(parsed?.prefix).toBe(k.prefix);
    expect(verifySecret(parsed!.secret, k.secretHash)).toBe(true);
  });

  it("rechaza secretos alterados y formatos inválidos", () => {
    const k = generateApiKey();
    const parsed = parseApiKey(k.token)!;
    const tampered = parsed.secret.slice(0, -1) + (parsed.secret.endsWith("A") ? "B" : "A");
    expect(verifySecret(tampered, k.secretHash)).toBe(false);
    expect(parseApiKey("pnx_live_short_x")).toBeNull();
    expect(parseApiKey("Bearer algo")).toBeNull();
  });

  it("cada key es única", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateApiKey().token));
    expect(tokens.size).toBe(200);
  });
});

describe("OIDC", async () => {
  const issuer = "https://idp.test";
  const audience = "pronex-api";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const verify = createOidcVerifier({ issuer, audience, jwks: createLocalJWKSet({ keys: [jwk] }) });

  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? issuer)
      .setAudience(opts.aud ?? audience)
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(privateKey);

  it("acepta un token válido", async () => {
    const id = await verify(await sign({ email: "ana@pyme.cl" }));
    expect(id).toEqual({ issuer, subject: "user-123", email: "ana@pyme.cl" });
  });

  it("rechaza issuer, audience o expiración incorrectos", async () => {
    await expect(verify(await sign({}, { iss: "https://otro.test" }))).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(verify(await sign({}, { aud: "otra-app" }))).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(verify(await sign({}, { exp: "-10m" }))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rechaza tokens firmados con otra llave", async () => {
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(issuer).setAudience(audience).setSubject("x").setExpirationTime("5m")
      .sign(other.privateKey);
    await expect(verify(forged)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rechaza alg=none", async () => {
    const unsigned = new UnsecuredJWT({}).setIssuer(issuer).setAudience(audience).setSubject("x")
      .setExpirationTime("5m").encode();
    await expect(verify(unsigned)).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe("SecretBox", () => {
  const box = new SecretBox(SecretBox.generateKey());

  it("cifra y descifra; cada cifrado es distinto", () => {
    const a = box.seal("EAAG-token", "tenant:1");
    expect(a).not.toContain("EAAG");
    expect(box.seal("EAAG-token", "tenant:1")).not.toBe(a);
    expect(box.open(a, "tenant:1")).toBe("EAAG-token");
  });

  it("falla si se mueve a otro tenant, se altera o se usa otra clave", () => {
    const a = box.seal("secreto", "tenant:1");
    expect(() => box.open(a, "tenant:2")).toThrow();
    const parts = a.split(".");
    parts[3] = Buffer.from("otro").toString("base64url");
    expect(() => box.open(parts.join("."), "tenant:1")).toThrow();
    expect(() => new SecretBox(SecretBox.generateKey()).open(a, "tenant:1")).toThrow();
  });

  it("exige una clave de 32 bytes", () => {
    expect(() => new SecretBox(Buffer.alloc(16).toString("base64"))).toThrow();
  });
});

describe("permiso channels:manage", () => {
  it("solo owner/admin, nunca una API key", () => {
    const u = (role: "admin" | "builder"): Principal => ({ kind: "user", userId: "u", tenantId: "t", role });
    expect(can(u("admin"), "channels:manage")).toBe(true);
    expect(can(u("builder"), "channels:manage")).toBe(false);
    expect(can({ kind: "api_key", keyId: "k", tenantId: "t", scopes: new Set(["channels:manage"]) }, "channels:manage")).toBe(false);
  });
});
