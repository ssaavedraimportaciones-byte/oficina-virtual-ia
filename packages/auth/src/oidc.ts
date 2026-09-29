import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface OidcConfig {
  issuer: string;
  audience: string;
  /** Por defecto se descarga de <issuer>/.well-known/jwks.json. Inyectable para tests. */
  jwks?: JWTVerifyGetKey;
  /** Algoritmos aceptados. Nunca incluye "none" ni HS* (secreto compartido). */
  algorithms?: string[];
}

export interface OidcIdentity {
  issuer: string;
  subject: string;
  email: string | null;
}

export class InvalidTokenError extends Error {}

export function createOidcVerifier(config: OidcConfig) {
  const jwks =
    config.jwks ?? createRemoteJWKSet(new URL(".well-known/jwks.json", config.issuer.replace(/\/?$/, "/")));
  const algorithms = config.algorithms ?? ["RS256", "ES256", "EdDSA"];

  return async function verify(token: string): Promise<OidcIdentity> {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms,
        clockTolerance: 30,
        requiredClaims: ["sub", "exp"],
      });
      return {
        issuer: config.issuer,
        subject: payload.sub!,
        email: typeof payload.email === "string" ? payload.email : null,
      };
    } catch (err) {
      throw new InvalidTokenError((err as Error).message);
    }
  };
}

export type OidcVerifier = ReturnType<typeof createOidcVerifier>;
