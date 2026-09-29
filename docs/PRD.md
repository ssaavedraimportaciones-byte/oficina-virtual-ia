# PRD — Pronex · Plataforma abierta de agentes IA omnicanal

> Estado: v1.1 (regenerado) · Estrategia: **Opción B — Plataforma abierta** · Fecha: 2026-09-29

## 1. Problema y oportunidad

Las empresas pierden leads porque tardan horas en responder. Nexor AI (getnexor.ai, respaldada por a16z, 7 países) resuelve esto con agentes de IA que atienden en <60 s por WhatsApp, voz, email, SMS e Instagram. Pero deja huecos explotables:

| Hueco de Nexor | Oportunidad para Pronex |
|---|---|
| Pricing opaco, solo con demo | Self-serve real + precios públicos |
| Sin builder visual documentado | Builder visual y capa de código (mismo artefacto) |
| QA reactiva (auditor post-mortem) | QA en tiempo real + regresión de prompts antes de publicar |
| Lock-in de canales y de LLM | Adaptadores de canal intercambiables, LLM agnóstico |
| Sin white-label | White-label para agencias (multi-tenant jerárquico) |
| Compliance poco transparente | Trust center público (SOC 2, DPA, subprocesadores) |

## 2. Personas

1. **Dueña de PyME (Operadora)** — quiere responder leads sin contratar. No técnica. Necesita plantillas y resultados en 1 día.
2. **Líder de ventas / CX (Gestor)** — mide conversión, SLA y calidad. Necesita dashboards y control de handoff humano.
3. **Desarrollador/a (Integrador)** — conecta CRM, APIs propias, MCP. Necesita API, SDK, webhooks y versionado.
4. **Agencia (Revendedor)** — gestiona 10–200 clientes. Necesita white-label, sub-cuentas y facturación por cliente.

## 3. Objetivos y métricas

| Objetivo | Métrica | Meta 6 meses |
|---|---|---|
| Activación rápida | Tiempo a primer agente en producción | < 30 min (p50) |
| Velocidad de respuesta | Primera respuesta al lead | < 20 s (p95) texto · < 1,5 s latencia de voz |
| Calidad | Conversaciones marcadas por QA como fallo | < 2 % |
| Negocio | Conversión lead→cita vs baseline del cliente | +25 % |
| Confianza | Incidentes de fuga cross-tenant | 0 |

## 4. Requisitos funcionales (con delta vs Nexor)

| # | Requisito | Delta vs Nexor |
|---|---|---|
| RF1 | Onboarding self-serve con plantilla por industria y conexión de WhatsApp guiada | Nexor exige demo |
| RF2 | 8 agentes plantilla (Expansión B2B, Contactabilidad, Re-contacto, Notificaciones, Ventas, CX, Recolector de documentos, Auditor) | Paridad + editables |
| RF3 | Builder visual de flujos (nodos: mensaje, condición, tool, espera, handoff) exportable a código TS/YAML | Nexor sin builder visual |
| RF4 | Bandeja unificada omnicanal con handoff humano en 1 clic y devolución al agente | Mejor control humano |
| RF5 | Tools por function-calling: CRM, calendario, pagos, HTTP genérico, MCP client | MCP bidireccional |
| RF6 | MCP server propio (leads, conversaciones, workflows, métricas) | Paridad (~80 tools) |
| RF7 | LLM agnóstico por agente (Claude, OpenAI, Gemini, modelos abiertos) con fallback | Nexor atado |
| RF8 | Guardrail en tiempo real: política, PII, alucinación de precios/stock, tono | Nexor post-mortem |
| RF9 | Suite de regresión de prompts: conversaciones doradas que deben pasar antes de publicar | No existe en Nexor |
| RF10 | Prompts y flujos versionados con diff, rollback y despliegue gradual (canary %) | No existe en Nexor |
| RF11 | Base de conocimiento (RAG) con citas de fuente y fecha de actualización | Transparencia |
| RF12 | Analítica: embudo, SLA, costo por conversación, calidad por agente/versión | Costo visible |
| RF13 | White-label y sub-cuentas para agencias | No existe en Nexor |
| RF14 | Precios públicos, medidor de uso en tiempo real y tope de gasto | Nexor opaco |

## 5. Requisitos de seguridad

### 5.1 Autenticación y autorización
- SSO OAuth2/OIDC + SAML en planes Business; MFA obligatorio para roles Admin.
- API keys con **scopes** mínimos, prefijo identificable, rotación y expiración.
- RBAC: Owner, Admin, Builder, Agente humano, Solo lectura; permisos por workspace.

### 5.2 Aislamiento multi-tenant
- `tenant_id` en todas las tablas + **Row Level Security** en Postgres (no solo filtro en la app).
- Tests automáticos de aislamiento en CI: cada endpoint probado con token de tenant A contra datos de tenant B.
- Índices vectoriales particionados por tenant; nunca búsqueda RAG global.

### 5.3 Protección de datos
- TLS 1.2+ en tránsito; AES-256 en reposo; claves por tenant (envelope encryption) en planes Enterprise.
- Redacción de PII antes de enviar a LLM cuando la política lo exija; redacción en logs siempre.
- GDPR/LGPD/Ley 21.719 (Chile): exportación y borrado por titular, retención configurable, DPA.

### 5.4 Seguridad de integraciones
- Webhooks entrantes verificados por firma (HMAC de Meta, Twilio, etc.) y con protección anti-replay.
- Webhooks salientes firmados; secretos en Secret Manager, nunca en BD en claro.
- Rate limiting por tenant, por API key y por lead.

### 5.5 Guardrails de agentes IA
- Tools en sandbox con allowlist de dominios y límites de tiempo/costo.
- Acciones irreversibles (cobros, borrados, envíos masivos) requieren confirmación humana o política explícita.
- Defensa contra prompt injection: contenido del lead y de documentos tratado como dato, nunca como instrucción del sistema.
- Log de auditoría inmutable (append-only) de cada decisión y llamada a tool.

### 5.6 Compliance
- SOC 2 Tipo I (mes 9) → Tipo II (mes 15); HIPAA-ready (BAA) en Enterprise.
- Pentest externo anual + bug bounty.
- Opt-in/opt-out de WhatsApp y horarios legales de contacto por país.

### 5.7 Infraestructura
- Vault/Secrets Manager, WAF, segmentación de red, mínimo privilegio en IAM.
- Backups cifrados con prueba de restauración mensual; RPO 15 min, RTO 1 h.

### 5.8 Respuesta a incidentes
- Runbooks, on-call, notificación a clientes afectados en < 72 h.

## 6. Requisitos no funcionales
- Disponibilidad 99,9 % (99,95 % Enterprise).
- Escala inicial: 1 000 tenants, 5 M mensajes/mes.
- Accesibilidad WCAG 2.1 AA; i18n español, portugués, inglés.

## 7. Modelo de negocio (precios públicos)

| Plan | Precio | Incluye |
|---|---|---|
| Starter | USD 49/mes | 1 agente, 1 000 conversaciones, WhatsApp + email |
| Growth | USD 199/mes | 5 agentes, 5 000 conversaciones, todos los canales texto, regresión de prompts |
| Business | USD 599/mes | Ilimitado agentes, voz, SSO, SLA 99,9 % |
| Agency / Enterprise | A medida (tabla pública de rangos) | White-label, BAA, claves propias |

Excedente: por conversación y por minuto de voz, con tope de gasto configurable.

## 8. Roadmap

- **Fase 1 (0–3 m)**: RLS + tests, auth, WhatsApp end-to-end, runtime de agente, guardrail, 3 plantillas.
- **Fase 2 (3–6 m)**: Builder visual, regresión de prompts, versionado/canary, email + SMS, MCP server.
- **Fase 3 (6–12 m)**: Voz, white-label, MCP client, marketplace de plantillas, SOC 2.

## 9. Fuera de alcance (v1)
- Llamadas salientes masivas en frío (riesgo regulatorio).
- Entrenamiento/fine-tuning de modelos propios.

## 10. Criterio de éxito
Un cliente PyME conecta WhatsApp, elige plantilla y responde su primer lead real en < 30 min sin hablar con ventas; 0 fugas cross-tenant; guardrail bloquea ≥ 95 % del set de ataques de prueba.
