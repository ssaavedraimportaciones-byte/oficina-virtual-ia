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
