# Pronex

Plataforma abierta de agentes de IA omnicanal (WhatsApp, voz, email, SMS, Instagram) que atienden leads en segundos.

> Esta rama (`pronex`) es un proyecto **independiente**: no comparte historial ni código con el resto del repositorio.

## Documentación

- [docs/PRD.md](docs/PRD.md) — producto, requisitos, seguridad, precios, roadmap.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura, decisiones, auditoría de 12 capas, orden de construcción.

## Estructura

```
apps/
  api/           API HTTP (Fastify): autenticación, onboarding, leads, API keys
packages/
  db/            Esquema Postgres multi-tenant con RLS, migraciones y tests de aislamiento
  auth/          RBAC, API keys y verificación de tokens OIDC
docs/            PRD y arquitectura
```

## Estado — Fase 1

| # | Paso | Estado |
|---|---|---|
| 1 | Esquema + RLS + tests de aislamiento cross-tenant en CI | ✅ |
| 2 | Gateway de auth (OIDC, API keys con scopes, RBAC) | ✅ |
| 3 | Canal WhatsApp end-to-end con idempotencia | ⏳ |
| 4 | Runtime del agente sobre Temporal | ⏳ |
| 5 | Guardrail síncrono con benchmark de latencia | ⏳ |
| 6 | Versionado de prompts + conversaciones doradas | ⏳ |

## Desarrollo

Requisitos: Node 22, pnpm 10, Postgres 16.

```bash
pnpm install
cp .env.example .env          # ajusta DATABASE_URL
pnpm test                     # recrea el esquema en la BD de test y corre los tests
pnpm db:migrate               # aplica migraciones pendientes
pnpm --filter @pronex/api dev # levanta la API (requiere APP_DATABASE_URL, OIDC_ISSUER, OIDC_AUDIENCE)
```

Los tests **borran y recrean** el esquema de la base indicada en `DATABASE_URL`: úsala solo con una base de pruebas.

## Cómo funciona el aislamiento

- Toda tabla de negocio tiene `tenant_id` y Row Level Security **habilitado y forzado**.
- La app se conecta como `pronex_app` (sin BYPASSRLS, no es dueña de las tablas).
- Todo acceso pasa por `withTenant(pool, tenantId, fn)`, que fija el tenant con `SET LOCAL` dentro de una transacción. Sin tenant fijado no se lee ni se escribe nada.
- Las FK incluyen `tenant_id`, así una fila no puede referenciar datos de otro tenant.
- `audit_log` es append-only (ni el dueño de la BD puede modificarlo).
- Un test guardián falla si una tabla nueva con `tenant_id` se crea sin RLS.

## Autenticación y permisos

| Credencial | Uso | Cómo se valida |
|---|---|---|
| Token OIDC (`Authorization: Bearer <jwt>`) | Personas desde la app | Firma contra el JWKS del proveedor, issuer, audience y expiración. Solo RS256/ES256/EdDSA. |
| API key (`Authorization: Bearer pnx_live_…`) | Integraciones | Prefijo único + SHA-256 del secreto comparado en tiempo constante. Expira (90 días por defecto) y se revoca al instante. |

- Roles: `owner`, `admin`, `builder`, `agent` (humano en bandeja), `viewer`. Ver `packages/auth/src/rbac.ts`.
- Una API key nunca puede gestionar keys, miembros ni facturación, aunque se le pida el scope.
- Usuarios con varios tenants eligen con el header `x-pronex-tenant`.
- Toda ruta `/v1` debe declarar su permiso; si no, responde 500 (deny-by-default).
- El token completo de una key solo se muestra al crearla; la app ni siquiera puede leer el hash.
- MFA y SSO/SAML se delegan al proveedor OIDC (Auth0, Clerk, Keycloak, etc.).

### Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| POST | /v1/tenants | usuario autenticado (onboarding) |
| GET | /v1/me | usuario autenticado |
| GET / POST | /v1/leads | leads:read / leads:write |
| GET / POST | /v1/api-keys | api_keys:manage |
| DELETE | /v1/api-keys/:id | api_keys:manage |
