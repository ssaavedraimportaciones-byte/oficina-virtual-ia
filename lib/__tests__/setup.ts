// Se ejecuta antes de cualquier test: apunta la app a la base de datos de
// test, nunca a la de desarrollo/producción, y antes de que lib/db.ts (que
// crea el cliente de Prisma al importarse por primera vez) tenga chance de
// leer DATABASE_URL con el valor equivocado.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:devpassword@localhost:5432/agentsapp_test'
process.env.ENCRYPTION_KEY ??=
  '4f8b2c1e9a7d3f5b6c8e0a2d4f6b8c1e3a5d7f9b1c3e5a7d9f1b3c5e7a9d1f3b'
process.env.META_APP_SECRET ??= 'secreto-de-app-de-meta-para-tests'

// En la sesión en la nube el contenedor reinicia el cluster de Postgres apagado,
// y la suite entera fallaba con "Can't reach database server", que parece un
// error del código y no lo es. Si la base no responde, se levanta sola.
if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  const { execSync } = require('child_process') as typeof import('child_process')
  const responde = () => {
    try {
      execSync('pg_isready -h localhost -p 5432', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
  if (!responde()) {
    try {
      const version = execSync('ls /usr/lib/postgresql').toString().trim().split('\n').sort().pop()
      execSync(`pg_ctlcluster ${version} main start`, { stdio: 'ignore' })
      for (let i = 0; i < 20 && !responde(); i += 1) execSync('sleep 1')
    } catch {
      // Si no se puede levantar, los tests fallan igual y con su error original.
    }
  }
}
