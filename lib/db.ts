import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

// En dev, Next.js recarga módulos en caliente: sin este caché quedarían
// decenas de PrismaClient (y de pools de conexión) abiertos a la vez.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL. Configurala en .env.local.')
  }
  // Cada función serverless puede crear su propio proceso. Limitar el pool a
  // una conexión evita multiplicar el límite de Supabase por instancia.
  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  })
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
