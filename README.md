# Pronex

Plataforma abierta de agentes de IA omnicanal (WhatsApp, voz, email, SMS, Instagram) que atienden leads en segundos.

> Esta rama (`pronex`) es un proyecto **independiente**: no comparte historial ni código con el resto del repositorio.

## Documentación

- [docs/PRD.md](docs/PRD.md) — producto, requisitos, seguridad, precios, roadmap.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura, decisiones, auditoría de 12 capas, orden de construcción.

## Estructura

```
packages/
  db/            Esquema Postgres multi-tenant con RLS, migraciones y tests de aislamiento
docs/            PRD y arquitectura
```

## Estado — Fase 1

| # | Paso | Estado |
|---|---|---|
| 1 | Esquema + RLS + tests de aislamiento cross-tenant en CI | ✅ |
| 2 | Gateway de auth (OIDC, API keys con scopes, RBAC) | ⏳ |
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
```

Los tests **borran y recrean** el esquema de la base indicada en `DATABASE_URL`: úsala solo con una base de pruebas.

## Cómo funciona el aislamiento

- Toda tabla de negocio tiene `tenant_id` y Row Level Security **habilitado y forzado**.
- La app se conecta como `pronex_app` (sin BYPASSRLS, no es dueña de las tablas).
- Todo acceso pasa por `withTenant(pool, tenantId, fn)`, que fija el tenant con `SET LOCAL` dentro de una transacción. Sin tenant fijado no se lee ni se escribe nada.
- Las FK incluyen `tenant_id`, así una fila no puede referenciar datos de otro tenant.
- `audit_log` es append-only (ni el dueño de la BD puede modificarlo).
- Un test guardián falla si una tabla nueva con `tenant_id` se crea sin RLS.
