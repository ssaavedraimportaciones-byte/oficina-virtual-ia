// Crea (o repara) un administrador de plataforma directo en la base.
// Uso:  DATABASE_URL=... node scripts/crear-admin.mjs correo@dominio.com [contraseña]
// Sin contraseña genera una al azar y la imprime una sola vez.
import { randomBytes, scrypt } from 'node:crypto'
import pg from 'pg'

const [emailArg, passwordArg] = process.argv.slice(2)
const url = process.env.DATABASE_URL
if (!url || !emailArg) {
  console.error('Uso: DATABASE_URL=... node scripts/crear-admin.mjs correo@dominio.com [contraseña]')
  process.exit(1)
}

const email = emailArg.toLowerCase().trim()
const password = passwordArg || randomBytes(9).toString('base64url')
const N = 16384

const salt = randomBytes(16)
const derived = await new Promise((resolve, reject) =>
  scrypt(password, salt, 64, { N }, (err, key) => (err ? reject(err) : resolve(key))),
)
const hash = `scrypt:${N}:${salt.toString('hex')}:${derived.toString('hex')}`

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } })
await client.connect()
try {
  const { rows } = await client.query(
    `INSERT INTO users (id, email, "passwordHash", role, "emailVerifiedAt", "termsAcceptedAt", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, 'PLATFORM_ADMIN', now(), now(), now())
     ON CONFLICT (email) DO UPDATE
       SET "passwordHash" = EXCLUDED."passwordHash", role = 'PLATFORM_ADMIN', "emailVerifiedAt" = COALESCE(users."emailVerifiedAt", now())
     RETURNING id, (xmax = 0) AS creado`,
    [email, hash],
  )
  await client.query('DELETE FROM sessions WHERE "userId" = $1', [rows[0].id])
  const total = (await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n
  console.log(rows[0].creado ? 'Admin creado.' : 'Admin existente actualizado.')
  console.log(`Correo: ${email}`)
  console.log(`Contraseña: ${password}`)
  console.log(`Usuarios totales en esta base: ${total}`)
} finally {
  await client.end()
}
