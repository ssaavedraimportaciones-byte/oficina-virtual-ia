/**
 * Permisos de la plataforma. Los roles de miembros y los scopes de API keys
 * hablan el mismo idioma, así una sola función `can()` decide en ambos casos.
 */
export const PERMISSIONS = [
  "leads:read",
  "leads:write",
  "conversations:read",
  "conversations:write",
  "agents:read",
  "agents:write",
  "agents:publish",
  "analytics:read",
  "api_keys:manage",
  "channels:manage",
  "members:manage",
  "billing:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "owner" | "admin" | "builder" | "agent" | "viewer";

const ALL = new Set<Permission>(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: ALL,
  admin: new Set(PERMISSIONS.filter((p) => p !== "billing:manage")),
  builder: new Set<Permission>([
    "leads:read", "conversations:read", "agents:read", "agents:write", "agents:publish", "analytics:read",
  ]),
  // Agente humano: atiende la bandeja y toma handoffs.
  agent: new Set<Permission>(["leads:read", "leads:write", "conversations:read", "conversations:write"]),
  viewer: new Set<Permission>(["leads:read", "conversations:read", "agents:read", "analytics:read"]),
};

/** Una API key nunca puede administrar keys, canales (tokens de terceros), miembros ni facturación. */
export const API_KEY_FORBIDDEN: ReadonlySet<Permission> = new Set([
  "api_keys:manage", "channels:manage", "members:manage", "billing:manage",
]);

export type Principal =
  | { kind: "user"; userId: string; tenantId: string; role: Role }
  | { kind: "api_key"; keyId: string; tenantId: string; scopes: ReadonlySet<Permission> };

export function can(principal: Principal, permission: Permission): boolean {
  if (principal.kind === "user") return ROLE_PERMISSIONS[principal.role].has(permission);
  return !API_KEY_FORBIDDEN.has(permission) && principal.scopes.has(permission);
}

export function isPermission(value: string): value is Permission {
  return (ALL as Set<string>).has(value);
}
