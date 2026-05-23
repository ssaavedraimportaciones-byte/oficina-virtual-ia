import { beforeAll } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-min-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-min-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  process.env.QR_SECRET = 'test-qr-secret-min-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
})
