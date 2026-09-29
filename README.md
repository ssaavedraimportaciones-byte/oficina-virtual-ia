# Pronex

Plataforma abierta de agentes de IA omnicanal (WhatsApp, voz, email, SMS, Instagram) que atienden leads en segundos.

> Esta rama (`pronex`) es un proyecto **independiente**: no comparte historial ni código con el resto del repositorio.

## Documentación

- [docs/PRD.md](docs/PRD.md) — producto, requisitos, seguridad, precios, roadmap.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura, decisiones, auditoría de 12 capas, orden de construcción.

## Estructura

```
apps/
  api/           API HTTP (Fastify): auth, onboarding, leads, API keys, webhooks y bandeja
  worker/        Worker de Temporal: un workflow por conversación que ejecuta al agente
packages/
  db/            Esquema Postgres multi-tenant con RLS, migraciones y tests de aislamiento
  auth/          RBAC, API keys, verificación OIDC y cifrado de secretos (SecretBox)
  channels/      Mensaje canónico y adaptador de WhatsApp Cloud API
  messaging/     Ingesta idempotente de mensajes, envío con reglas (handoff, ventana 24 h) y outbox
  agent/         Runtime del agente: bucle con herramientas sobre Claude, presupuestos y reanudación
docs/            PRD y arquitectura
```

## Estado — Fase 1

| # | Paso | Estado |
|---|---|---|
| 1 | Esquema + RLS + tests de aislamiento cross-tenant en CI | ✅ |
| 2 | Gateway de auth (OIDC, API keys con scopes, RBAC) | ✅ |
| 3 | Canal WhatsApp end-to-end con idempotencia | ✅ |
| 4 | Runtime del agente sobre Temporal | ✅ |
| 5 | Guardrail síncrono con benchmark de latencia | ⏳ |
| 6 | Versionado de prompts + conversaciones doradas | ⏳ |

## Desarrollo

Requisitos: Node 22, pnpm 10, Postgres 16, Redis 7 y la CLI de Temporal (los tests la descargan si falta `TEMPORAL_CLI_PATH`).

```bash
pnpm install
cp .env.example .env          # ajusta DATABASE_URL
pnpm test                     # recrea el esquema en la BD de test y corre los tests
pnpm db:migrate               # aplica migraciones pendientes
pnpm --filter @pronex/api dev # levanta la API (requiere APP_DATABASE_URL, OIDC_ISSUER, OIDC_AUDIENCE)
temporal server start-dev     # Temporal local
pnpm --filter @pronex/worker start  # worker del agente (requiere ANTHROPIC_API_KEY)
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
- Rate limiting en Redis (compartido entre réplicas), por minuto: 1 200 por IP (antes de autenticar, frena fuerza bruta), 600 por API key, 300 por usuario y 3 000 por tenant. Al superarlo: `429` + `Retry-After`.

### Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| POST | /v1/tenants | usuario autenticado (onboarding) |
| GET | /v1/me | usuario autenticado |
| GET / POST | /v1/leads | leads:read / leads:write |
| GET / POST | /v1/api-keys | api_keys:manage |
| DELETE | /v1/api-keys/:id | api_keys:manage |
| POST | /v1/channels/whatsapp | channels:manage |
| GET | /v1/conversations | conversations:read |
| GET | /v1/conversations/:id/messages | conversations:read |
| POST | /v1/conversations/:id/messages | conversations:write (texto o plantilla; toma la conversación) |
| POST | /v1/conversations/:id/release | conversations:write (devuelve la conversación al agente) |
| GET / POST | /webhooks/whatsapp | público, verificado por firma de Meta |

## WhatsApp

**Flujo de entrada:** Meta → `POST /webhooks/whatsapp` → verificación de firma HMAC sobre el cuerpo crudo → mensaje canónico → upsert de lead por teléfono y de la conversación abierta → alta del mensaje con `ON CONFLICT (provider_msg_id)` → despacho al runtime del agente.

Garantías (cada una con test):

- **Firma:** sin `X-Hub-Signature-256` válida → 401, nada se guarda.
- **Idempotencia:** Meta reenvía webhooks; el mismo `wamid` se guarda una vez y **no dispara una segunda respuesta**.
- **Concurrencia:** una ráfaga de mensajes de un número nuevo crea 1 lead y 1 conversación.
- **Outbox:** si el runtime del agente está caído, el mensaje queda pendiente y un barrido cada 30 s lo re-despacha.
- **Handoff:** cuando un humano escribe, toma la conversación y el agente no puede responder hasta que se libere.
- **Ventana de 24 h:** fuera de ella solo se aceptan plantillas aprobadas.
- **Estados de entrega:** avanzan (`sent → delivered → read`) y nunca retroceden aunque lleguen desordenados.
- **Tokens de Meta:** cifrados con AES-256-GCM atados al tenant; una API key no puede conectar canales.
- **Número no conectado:** se responde 200 (para que Meta no reintente sin fin) y se registra un warning.

### Conectar un número real

1. En [developers.facebook.com](https://developers.facebook.com) crea una app tipo *Business* y agrega el producto **WhatsApp**.
2. Copia el **App Secret** (Configuración → Básica) → `META_APP_SECRET`.
3. Elige un texto cualquiera como `WHATSAPP_VERIFY_TOKEN`.
4. En WhatsApp → Configuración, registra el webhook `https://<tu-dominio>/webhooks/whatsapp` con ese verify token y suscríbete al campo **messages**.
5. Genera un **token de acceso de usuario del sistema** con permiso `whatsapp_business_messaging` y copia el **Phone number ID**.
6. Conéctalo en Pronex: `POST /v1/channels/whatsapp` con `workspaceId`, `phoneNumberId` y `accessToken`.

Limitación conocida: si Meta enviara un estado de entrega antes de que guardemos el `wamid` de la respuesta, ese estado se perdería (en la práctica Meta responde el `wamid` primero).

## Agente (runtime sobre Temporal)

**Flujo:** webhook → mensaje guardado → `signalWithStart` al workflow `conversation-<id>` → espera 3 s por si el cliente sigue escribiendo → actividad `runAgentTurn` → respuesta por WhatsApp.

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) por defecto, configurable por versión de agente. Cada petición lleva:

- `output_config.effort` explícito (por defecto `medium`); el razonamiento es adaptativo y siempre activo en este modelo.
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): si el modelo declina por sus salvaguardas, Anthropic reintenta en el mismo request con el modelo recomendado para esa categoría. Si aun así hay negativa, el agente no responde, avisa y pasa a humano.
- Caché de prompt: reglas de plataforma + instrucciones del agente (prefijo estable) y caché automático del historial.
- Herramientas con `strict: true` y `tool_choice` automático (forzar herramientas no está permitido en este modelo).

Garantías (cada una con test, y las principales verificadas inyectando la falla):

| Garantía | Cómo |
|---|---|
| Nunca dos respuestas en paralelo en una conversación | Un workflow por conversación (id fijo) |
| Una ráfaga de mensajes recibe una sola respuesta | Debounce de 3 s (tope 15 s) en el workflow |
| Un crash o reintento no duplica ni pierde el turno | Cada paso se guarda en `agent_transcripts` antes de seguir; el reintento retoma desde ahí |
| Historial válido para el razonamiento del modelo | `agent_transcripts` es append-only (trigger) y se reenvía sin editar |
| Sin bucles caros | Tope de pasos por turno (6), presupuesto por conversación (USD 0,50) y diario por tenant (USD 20) |
| Costo real por ejecución | Tokens y USD por modelo que respondió (incluido el de respaldo) en `agent_runs` |
| El agente no pisa a un humano | Si un humano tomó la conversación, el agente no lee ni responde; al liberarla recibe lo que se habló |
| Fallas no dejan al cliente sin respuesta | Error permanente, reintentos agotados, negativa o límite → aviso al cliente + handoff |
| Herramientas acotadas | Solo las habilitadas en la versión del agente; entradas validadas (el modelo es fuente no confiable) |
| Inyección de instrucciones | Las reglas de plataforma declaran los mensajes del cliente como datos, no instrucciones |

Herramientas disponibles: `handoff_to_human`, `update_lead`.
