import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// El resto del proyecto guarda los secretos en .env.local (Next.js los carga
// solo); Prisma CLI no lo hace por su cuenta, así que se carga acá a mano.
config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
