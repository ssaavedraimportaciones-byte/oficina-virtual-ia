# Pronex en tu PC

Guía para levantar Pronex completo en tu computador y conversar con el agente por un simulador de WhatsApp, usando Claude de verdad. Funciona igual en Windows (PowerShell), macOS y Linux.

## 1. Lo que necesitas

| Herramienta | Para qué | Cómo comprobarlo |
|---|---|---|
| **Git** | Bajar el código | `git --version` |
| **Node.js 22** o superior | Ejecutar Pronex | `node --version` |
| **pnpm 10** | Instalar dependencias | `pnpm --version` (si falta: `npm install -g pnpm`) |
| **Docker Desktop** (encendido) | Postgres, Redis y Temporal | `docker compose version` |
| **Clave de API de Anthropic** | Que el agente piense con Claude | Se crea en [console.anthropic.com](https://console.anthropic.com) → *API Keys* |

Puertos que se usan: 55432 (Postgres), 56379 (Redis), 7233 y 8233 (Temporal), 3000 (API), 4010 (simulador).

## 2. Bajar el código

```bash
git clone -b pronex https://github.com/ssaavedraimportaciones-byte/oficina-virtual-ia.git pronex
cd pronex
pnpm install
```

## 3. Levantar los servicios

```bash
docker compose up -d
```

La primera vez descarga las imágenes (unos minutos). Para ver que están arriba: `docker compose ps`.

## 4. Preparar la base de datos y los datos de ejemplo

```bash
pnpm local:setup
```

Esto:
- crea el archivo **`.env`** con secretos nuevos,
- aplica las migraciones,
- crea una empresa de ejemplo (*Clínica Sonrisa*), un agente publicado, 3 conversaciones doradas, un número de WhatsApp simulado y una **API key** (queda en `.pronex-local.json`).

Ahora abre **`.env`** y pega tu clave en la primera línea:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Puedes correr `pnpm local:setup` las veces que quieras: no duplica nada.

## 5. Arrancar Pronex

```bash
pnpm local:dev
```

Levanta la API y el worker del agente. Déjalo corriendo. Verás `Worker de Pronex escuchando…` y `Server listening…`.

## 6. Conversar con el agente

En **otra terminal**, dentro de la carpeta del proyecto:

```bash
pnpm local:chat
```

Escribe como si fueras un cliente por WhatsApp:

```
Tú: Hola, ¿cuánto cuesta una limpieza?
Agente → ¡Hola! La limpieza dental cuesta $35.000. ¿Te gustaría agendar una hora?
```

- El agente espera unos 3 segundos por si sigues escribiendo, y responde todo junto.
- `/nuevo` cambia a otro cliente (conversación nueva). `/salir` termina.
- Si pides hablar con una persona, o hay una urgencia, la conversación pasa a una persona y el agente deja de responder en esa conversación: usa `/nuevo` para seguir probando.

Para ver cada conversación paso a paso (reintentos, tiempos): la interfaz de Temporal en **http://localhost:8233**.

## 7. Usar la API

Toma la API key de `.pronex-local.json` (campo `apiKey`) y los ids de ahí mismo.

```bash
# Bandeja de conversaciones
curl http://localhost:3000/v1/conversations -H "Authorization: Bearer <API_KEY>"

# Mensajes de una conversación
curl http://localhost:3000/v1/conversations/<ID>/messages -H "Authorization: Bearer <API_KEY>"

# Devolver una conversación al agente (tras un traspaso a persona)
curl -X POST http://localhost:3000/v1/conversations/<ID>/release -H "Authorization: Bearer <API_KEY>"
```

> En PowerShell usa `curl.exe` en lugar de `curl`.

### Cambiar el agente de forma segura

Las versiones no se editan: se crea una nueva, se prueba con las conversaciones doradas y recién ahí se publica.

```bash
# 1. Nueva versión (solo lo que cambia; lo demás se hereda)
curl -X POST http://localhost:3000/v1/agents/<AGENT_ID>/versions \
  -H "Authorization: Bearer <API_KEY>" -H "content-type: application/json" \
  -d '{"prompt": "…tu nuevo prompt…", "notes": "agrego precios de ortodoncia"}'

# 2. Probarla con las conversaciones doradas (usa Claude: tiene un costo pequeño)
curl -X POST http://localhost:3000/v1/agents/<AGENT_ID>/versions/<VERSION_ID>/evaluate -H "Authorization: Bearer <API_KEY>"

# 3a. Publicarla para todos…
curl -X POST http://localhost:3000/v1/agents/<AGENT_ID>/publish \
  -H "Authorization: Bearer <API_KEY>" -H "content-type: application/json" -d '{"versionId": "<VERSION_ID>"}'

# 3b. …o probarla primero con el 20 % de las conversaciones
curl -X POST http://localhost:3000/v1/agents/<AGENT_ID>/publish \
  -H "Authorization: Bearer <API_KEY>" -H "content-type: application/json" -d '{"versionId": "<VERSION_ID>", "canaryPercent": 20}'

# Si algo sale mal: volver a la versión anterior al instante
curl -X POST http://localhost:3000/v1/agents/<AGENT_ID>/rollback \
  -H "Authorization: Bearer <API_KEY>" -H "content-type: application/json" -d '{"versionId": "<VERSION_ANTERIOR>"}'
```

Si la evaluación falla, publicar responde `409 golden_cases_failed` con el detalle de qué caso falló y por qué.

Agregar una conversación dorada:

```bash
curl -X POST http://localhost:3000/v1/agents/<AGENT_ID>/golden-cases \
  -H "Authorization: Bearer <API_KEY>" -H "content-type: application/json" \
  -d '{"name": "pregunta por ortodoncia", "turns": ["¿Cuánto sale la ortodoncia?"], "expectations": {"must_contain": ["1.200.000"], "expect_handoff": false}}'
```

## 8. Conectar tu WhatsApp real (opcional)

1. Expón tu API a internet con un túnel, por ejemplo `cloudflared tunnel --url http://localhost:3000` o `ngrok http 3000`. Anota la URL https.
2. En [developers.facebook.com](https://developers.facebook.com) crea una app tipo *Business* con el producto **WhatsApp**.
3. En `.env`: pon el **App Secret** de la app en `META_APP_SECRET` y **borra** la línea `META_GRAPH_BASE_URL`.
4. En WhatsApp → Configuración de la app de Meta: webhook `https://<tu-túnel>/webhooks/whatsapp`, token de verificación = el valor de `WHATSAPP_VERIFY_TOKEN` de tu `.env`, y suscríbete al campo **messages**.
5. Conecta el número (Phone number ID y token de acceso de la sección *API Setup*):
   ```bash
   pnpm local:whatsapp -- --phone-number-id 1234567890 --token EAAG...
   ```
6. Reinicia `pnpm local:dev` y escribe al número desde tu teléfono.

## 9. Pruebas automáticas

Necesitan una base de datos **de pruebas** (su nombre debe contener "test": los tests la borran y la recrean).

```bash
docker compose exec postgres createdb -U postgres pronex_test
```

macOS / Linux:
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:55432/pronex_test REDIS_URL=redis://localhost:56379 pnpm test
```

PowerShell:
```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:55432/pronex_test"; $env:REDIS_URL="redis://localhost:56379"; pnpm test
```

La primera vez, los tests del worker descargan la CLI de Temporal.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `Postgres no responde` en `local:setup` | Docker no está encendido o los servicios no subieron: `docker compose up -d` y `docker compose ps`. |
| El agente siempre contesta "Una persona del equipo continuará…" | La clave de Anthropic es inválida o falta. Revisa `ANTHROPIC_API_KEY` en `.env` y reinicia `pnpm local:dev`. El motivo exacto queda en la tabla `agent_runs` (columna `error`). |
| El agente no contesta nada | Esa conversación está a cargo de una persona (tras un traspaso). Usa `/nuevo` en el simulador, o devuélvela al agente con `POST /v1/conversations/<ID>/release` (sección 7). |
| `El puerto 4010 está ocupado` | Ya hay otro `pnpm local:chat` abierto. |
| Un puerto de Docker está ocupado | Cambia el puerto del lado izquierdo en `docker-compose.yml` y el mismo número en `.env`. |
| Aviso `… de .env reemplaza el valor que tenía tu terminal` | Tenías esa variable definida en el sistema; se usa la de `.env`. |

Para apagar todo: `Ctrl+C` en la terminal de `local:dev` y `docker compose down` (los datos se conservan; `docker compose down -v` los borra).
