#!/usr/bin/env node
/**
 * Despliega ZeroVisto en Vercel desde tu computador, de punta a punta:
 *
 *   1. Inicia sesión en Vercel (si hace falta, abre el navegador).
 *   2. Encuentra el servidor de la base de datos que responde (Supabase tiene
 *      dos posibles según el proyecto) y arma las URLs de conexión.
 *   3. Crea el proyecto en Vercel (o reutiliza el que ya existe) y lo enlaza.
 *   4. Carga las variables de entorno (genera las claves que faltan).
 *   5. Publica en producción y muestra el link.
 *
 * Uso (desde la carpeta del proyecto, después de `npm install`):
 *
 *   node scripts/desplegar.mjs --clave-db "LA_CLAVE" [--anthropic "sk-ant-..."]
 *                              [--meta-secret "..."] [--equipo zeroailabcanal-7359]
 *                              [--proyecto zerovisto]
 *
 * Se puede volver a ejecutar: actualiza las variables y publica de nuevo.
 * Ningún secreto se guarda en el repositorio.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const SUPABASE_REF = 'crmwxrlpqelstxhiprlz'
const DB_USER = `app_zerovisto.${SUPABASE_REF}`
const POOLER_HOSTS = ['aws-0-sa-east-1.pooler.supabase.com', 'aws-1-sa-east-1.pooler.supabase.com']
const SECRETS_FILE = '.vercel/zerovisto-secretos.json' // queda fuera de git (.vercel/ está en .gitignore)

// --- Argumentos -----------------------------------------------------------------
const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const team = arg('equipo', 'zeroailabcanal-7359')
const project = arg('proyecto', 'zerovisto')
let dbPassword = arg('clave-db')
const anthropicKey = arg('anthropic')
const metaSecret = arg('meta-secret')

const ok = (msg) => console.log(`\x1b[32m✔\x1b[0m ${msg}`)
const step = (msg) => console.log(`\n\x1b[1m▸ ${msg}\x1b[0m`)
const fail = (msg) => {
  console.error(`\n\x1b[31m✘ ${msg}\x1b[0m\n`)
  process.exit(1)
}

// --- Vercel CLI ---------------------------------------------------------------------
// Se usa vía npx para no exigir una instalación global. En Windows, npx es un .cmd
// y necesita shell; los valores secretos nunca van como argumentos, van por stdin.
const isWin = process.platform === 'win32'
function vercel(cmdArgs, { input, capture = false, allowFail = false, timeoutMs = 120_000 } = {}) {
  const full = ['--yes', 'vercel@62', ...cmdArgs, '--scope', team]
  const res = spawnSync(isWin ? 'npx.cmd' : 'npx', full, {
    input,
    shell: isWin,
    // La entrada se cierra (nada que escribir): si el CLI intentara preguntar algo,
    // falla en vez de dejar la terminal colgada esperando una respuesta invisible.
    stdio: [input !== undefined ? 'pipe' : 'ignore', capture ? 'pipe' : 'inherit', 'inherit'],
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' },
  })
  if (res.error?.code === 'ETIMEDOUT') {
    fail(`"vercel ${cmdArgs.join(' ')}" tardó demasiado y se canceló. Vuelve a ejecutar el script.`)
  }
  if (res.status !== 0 && !allowFail) {
    fail(`Falló: vercel ${cmdArgs.join(' ')}`)
  }
  return res
}

// --- 0. Revisiones previas --------------------------------------------------------
if (!existsSync('package.json') || !existsSync('prisma/schema.prisma')) {
  fail('Ejecuta este comando dentro de la carpeta del proyecto (donde está package.json).')
}
if (!existsSync('node_modules/pg')) {
  fail('Primero instala las dependencias:  npm install')
}

if (!dbPassword) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  dbPassword = (await rl.question('Clave de la base de datos (te la dio Claude): ')).trim()
  rl.close()
}
if (!dbPassword) fail('Falta la clave de la base de datos (--clave-db).')

// --- 1. Sesión en Vercel ----------------------------------------------------------
step('1/5  Sesión en Vercel')
const who = spawnSync(isWin ? 'npx.cmd' : 'npx', ['--yes', 'vercel@62', 'whoami'], {
  shell: isWin,
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'inherit'], // stderr visible: si el CLI pide iniciar sesión, que se vea
  env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' },
})
if (who.status !== 0) {
  console.log('Se va a abrir el navegador para que entres a tu cuenta de Vercel…')
  const login = spawnSync(isWin ? 'npx.cmd' : 'npx', ['--yes', 'vercel@62', 'login'], {
    shell: isWin,
    stdio: 'inherit',
    env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' },
  })
  if (login.status !== 0) fail('No se pudo iniciar sesión en Vercel.')
} else {
  ok(`Sesión iniciada como ${who.stdout.trim()}`)
}

// --- 2. Base de datos -------------------------------------------------------------
step('2/5  Buscando el servidor de la base de datos')
const { default: pg } = await import('pg')
let host = null
for (const candidate of POOLER_HOSTS) {
  const client = new pg.Client({
    host: candidate,
    port: 6543,
    user: DB_USER,
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  })
  try {
    await client.connect()
    await client.query('select 1')
    await client.end()
    host = candidate
    break
  } catch (error) {
    await client.end().catch(() => {})
    const msg = error instanceof Error ? error.message : String(error)
    if (/password authentication failed/i.test(msg)) {
      fail('La clave de la base de datos no es correcta. Revisa que la copiaste completa.')
    }
    console.log(`  · ${candidate}: no (${msg})`)
  }
}
if (!host) {
  fail(
    'No se pudo conectar a la base de datos. Revisa tu conexión a internet y que el proyecto ' +
      '"agentsapp" esté activo en supabase.com (si está en pausa, ponlo en marcha y reintenta).',
  )
}
ok(`Base de datos: ${host}`)
const enc = encodeURIComponent(dbPassword)
const databaseUrl = `postgresql://${DB_USER}:${enc}@${host}:6543/postgres?sslmode=no-verify`
const directUrl = `postgresql://${DB_USER}:${enc}@${host}:5432/postgres?sslmode=no-verify`

// --- 3. Proyecto en Vercel --------------------------------------------------------
step(`3/5  Proyecto "${project}" en Vercel (${team})`)
vercel(['project', 'add', project], { allowFail: true }) // si ya existe, no pasa nada
vercel(['link', '--yes', '--project', project, '--team', team])
ok('Carpeta enlazada al proyecto')

// --- 4. Variables de entorno ------------------------------------------------------
step('4/5  Variables de entorno')
// Las claves generadas se guardan en .vercel/ (fuera de git) para que, al volver a
// ejecutar el script, sean las mismas: cambiar ENCRYPTION_KEY dejaría ilegibles los
// tokens de Meta ya guardados.
let saved = {}
try {
  saved = JSON.parse(readFileSync(SECRETS_FILE, 'utf8'))
} catch {}
const gen = (key, bytes) => saved[key] ?? (saved[key] = randomBytes(bytes).toString('hex'))
const env = {
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl,
  ENCRYPTION_KEY: gen('ENCRYPTION_KEY', 32),
  WHATSAPP_VERIFY_TOKEN: gen('WHATSAPP_VERIFY_TOKEN', 16),
  INSTAGRAM_VERIFY_TOKEN: gen('INSTAGRAM_VERIFY_TOKEN', 16),
  ALLOW_SIGNUP: 'true',
  BUSINESS_TIMEZONE: 'America/Santiago',
  NEXT_PUBLIC_APP_NAME: 'ZeroVisto',
}
if (anthropicKey) env.ANTHROPIC_API_KEY = anthropicKey
if (metaSecret) env.META_APP_SECRET = metaSecret
mkdirSync('.vercel', { recursive: true })
writeFileSync(SECRETS_FILE, JSON.stringify(saved, null, 2))

for (const [key, value] of Object.entries(env)) {
  vercel(['env', 'add', key, 'production', '--force', '--yes'], { input: value, capture: true })
  ok(key)
}

// --- 5. Publicar ------------------------------------------------------------------
step('5/5  Publicando en producción (tarda 2 a 4 minutos)')
const deploy = vercel(['deploy', '--prod', '--yes'], { capture: true, timeoutMs: 900_000 })
const url = (deploy.stdout || '').trim().split(/\s+/).pop()

console.log(`
\x1b[32m\x1b[1m✔ ZeroVisto está publicado.\x1b[0m

  Link:  ${url}
  (el dominio fijo del proyecto aparece en vercel.com → ${project} → Domains)

Datos para la pantalla Conexiones / la app de Meta:
  WHATSAPP_VERIFY_TOKEN   ${env.WHATSAPP_VERIFY_TOKEN}
  INSTAGRAM_VERIFY_TOKEN  ${env.INSTAGRAM_VERIFY_TOKEN}
${anthropicKey ? '' : `
Falta la clave de Anthropic: sin ella el agente no responde. Cuando la tengas:
  node scripts/desplegar.mjs --clave-db "…" --anthropic "sk-ant-…"
`}${metaSecret ? '' : `
Falta el App Secret de Meta (developers.facebook.com → tu app → Configuración → Básica).
Sin él no se aceptan los mensajes que manda Meta. Cuando lo tengas, agrega --meta-secret "…".
`}`)
