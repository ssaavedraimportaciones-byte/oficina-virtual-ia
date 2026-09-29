# ARCHITECTURE — Pronex

> v1.1 (regenerada, con las correcciones de la auditoría ya incorporadas) · 2026-09-29

## 1. Vista general

```
 Canales (WhatsApp · Voz · Email · SMS · Instagram · Web)
        │  webhooks firmados
        ▼
 ┌──────────────────────┐    ┌───────────────────────┐
 │ Ingress / Adaptadores│───▶│ Bus de eventos (Redis │
 │ → Mensaje canónico   │    │ Streams, idempotente) │
 └──────────────────────┘    └──────────┬────────────┘
                                         ▼
                           ┌───────────────────────────┐
                           │ Temporal: workflow por    │
                           │ conversación (durable)    │
                           └──────┬──────────┬─────────┘
                                  ▼          ▼
                     ┌────────────────┐  ┌─────────────────┐
                     │ Runtime agente │  │ Guardrail (sync │
                     │ LLM gateway +  │─▶│ + async, con    │
                     │ tools sandbox  │  │ presupuesto ms) │
                     └──────┬─────────┘  └────────┬────────┘
                            ▼                     ▼
                ┌──────────────────────────────────────────┐
                │ Postgres 16 + RLS + pgvector · Log audit │
                └──────────────────────────────────────────┘
      API Fastify · App Next.js · MCP server/client · Analítica
```

## 2. Decisiones estructurales

| # | Decisión | Por qué |
|---|---|---|
| D1 | Workflows durables con Temporal: un workflow por conversación | Esperas de días (re-contacto), reintentos y reanudación tras caídas sin perder estado |
| D2 | Mensaje canónico + adaptadores de canal | Añadir un canal = 1 adaptador; el agente no conoce el canal |
| D3 | RLS en Postgres con app.tenant_id por transacción | El aislamiento no depende de que cada query recuerde filtrar |
| D4 | Guardrail con presupuesto de latencia (reglas rápidas síncronas ≤150 ms; juez LLM asíncrono) | Calidad en tiempo real sin romper el SLA de respuesta |
| D5 | Prompts y flujos como artefactos versionados (hash inmutable, diff, canary, rollback) | Habilita regresión de prompts y trazabilidad por versión |
| D6 | MCP bidireccional: server (exponer la plataforma) + client (consumir tools de terceros) | Interoperabilidad y diferenciación frente a Nexor |

## 3. Stack

- **Lenguaje**: TypeScript monorepo (pnpm + Turborepo).
- **Front**: Next.js (App Router), builder visual con React Flow.
- **API**: Fastify + Zod; OpenAPI generado.
- **Datos**: Postgres 16 + pgvector + RLS; Redis (cache, rate limit, streams).
- **Orquestación**: Temporal.
- **LLM gateway**: capa propia con proveedores intercambiables (Claude como default, OpenAI/Gemini/abiertos como alternativa), fallback y medición de costo.
- **Canales**: WhatsApp Meta Cloud API; SMS/email vía Twilio/SES; voz vía Vapi o LiveKit.
- **Observabilidad**: OpenTelemetry → trazas por conversación (lead_id, workflow_id, prompt_version).

## 4. Modelo de datos (núcleo)

`tenants` → `workspaces` → `agents` → `agent_versions` (prompt, tools, modelo, hash)
`leads` → `conversations` → `messages` (canónico) → `tool_calls` → `guardrail_events`
`knowledge_sources` → `chunks (embedding, tenant_id)`
`audit_log` (append-only, sin UPDATE/DELETE por permisos)

Todas las tablas llevan `tenant_id NOT NULL` y política RLS.

## 5. Auditoría de arquitectura (12 capas de fallo) y correcciones

> Nota: la tabla original de la sesión anterior se truncó. Estos hallazgos se reconstruyeron volviendo a pasar las 12 capas sobre esta arquitectura; revisa si falta alguno que recuerdes.

| Sev. | Capa | Hallazgo | Corrección aplicada |
|---|---|---|---|
| Crítico | Idempotencia | Meta/Twilio reenvían webhooks → mensajes duplicados y dobles respuestas | Clave de idempotencia (channel, provider_msg_id) con UNIQUE; el workflow deduplica señales |
| Crítico | Prompt injection | Texto del lead o documentos RAG pueden ordenar al agente usar tools | Separación estricta sistema/datos, tools con allowlist por agente, confirmación humana para acciones irreversibles |
| Crítico | Aislamiento | Workers de Temporal y jobs en background no pasan por el middleware HTTP → podrían saltarse RLS | tenant_id obligatorio en cada input de actividad; conexión con SET LOCAL app.tenant_id; rol de BD sin BYPASSRLS |
| Alto | Concurrencia | Varios mensajes seguidos del lead generan respuestas en paralelo | Un workflow por conversación (serialización) + ventana de agrupación de 2–4 s |
| Alto | Dependencia LLM | Caída o rate-limit del proveedor detiene todo | Fallback de modelo, circuit breaker y respuesta de contención ("te respondo en unos minutos") |
| Alto | Costos | Bucles de tools o conversaciones largas disparan gasto | Límite de pasos por turno, presupuesto de tokens por conversación y tope de gasto por tenant |
| Alto | Contexto | Historial largo satura la ventana y degrada calidad | Resumen incremental + memoria estructurada del lead; prompt caching del prefijo estable |
| Medio | Handoff | Humano y agente responden a la vez | Estado de conversación con lock (agent / human); el agente queda en pausa hasta liberar |
| Medio | Ventana WhatsApp 24 h | Mensajes fuera de ventana fallan | El runtime cambia a plantillas aprobadas automáticamente fuera de la ventana |
| Medio | Evaluación | Cambios de prompt rompen casos que antes funcionaban | Suite de conversaciones doradas obligatoria en CI de agentes; canary 5 % → 100 % |
| Medio | Observabilidad | Difícil explicar por qué el agente respondió algo | Traza por turno con versión de prompt, contexto recuperado, tools y veredicto del guardrail |
| Bajo | Tools externas | Timeouts de CRM bloquean la respuesta | Timeout por tool (≤5 s), reintento en actividad Temporal, respuesta parcial al lead |

## 6. Orden de construcción — Fase 1

1. Esquema + RLS + **tests de aislamiento cross-tenant** en CI.
2. Gateway de auth (OIDC, API keys con scopes, RBAC).
3. Canal WhatsApp end-to-end con idempotencia.
4. Runtime del agente sobre Temporal (serialización, límites de pasos/costo).
5. Guardrail síncrono con **benchmark de latencia** (p95 ≤150 ms) y set de ataques de inyección.
6. Versionado de prompts + primeras conversaciones doradas.
