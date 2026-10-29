import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import * as auth from '../auth'
import type { SessionUser } from '../auth'
import * as store from '../store'
import { prisma } from '../db'
import { checkImage, detectImageType, MAX_IMAGE_BYTES } from '../productImage'

import * as catalogRoute from '@/app/api/businesses/[id]/catalogo/route'
import * as imageRoute from '@/app/api/products/[id]/image/route'
import * as publicImageRoute from '@/app/api/imagenes/producto/[id]/route'

/** PNG de 1x1 píxel: lo mínimo que tiene la firma real de un PNG. */
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  ),
)
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
const WEBP = Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), 0x56, 0x50])
const html = (text: string) => Uint8Array.from(Buffer.from(text))

describe('qué archivos se aceptan como foto', () => {
  it('reconoce JPG, PNG y WebP por sus bytes', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg')
    expect(detectImageType(PNG)).toBe('image/png')
    expect(detectImageType(WEBP)).toBe('image/webp')
  })

  it('rechaza un HTML o un SVG aunque se llame foto.jpg', () => {
    expect(checkImage(html('<html><script>alert(1)</script></html>')).ok).toBe(false)
    expect(checkImage(html('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')).ok).toBe(false)
  })

  it('rechaza un archivo vacío y uno demasiado grande', () => {
    expect(checkImage(new Uint8Array(0))).toMatchObject({ ok: false })
    const grande = new Uint8Array(MAX_IMAGE_BYTES + 1)
    grande.set(JPEG)
    expect(checkImage(grande)).toMatchObject({ ok: false })
  })

  it('acepta justo el tamaño máximo', () => {
    const justo = new Uint8Array(MAX_IMAGE_BYTES)
    justo.set(JPEG)
    expect(checkImage(justo)).toEqual({ ok: true, type: 'image/jpeg' })
  })
})

interface Tenant {
  user: SessionUser
  businessId: string
  productId: string
}

async function createTenant(label: string): Promise<Tenant> {
  const created = await auth.createUser({
    email: `${label}-${randomUUID()}@fotos.test`,
    password: 'clave-123456',
    role: 'USER',
  })
  if (!created.ok) throw new Error(created.reason)
  const business = await store.createBusiness(
    { agentName: 'A', businessName: `Local ${label}`, industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'gastronomia',
  )
  await auth.addBusinessMember(created.id, business.id, 'OWNER')
  const product = await store.addProduct({ businessId: business.id, name: 'Pizza', price: 9000, stock: null })
  return {
    user: { id: created.id, email: `${label}@fotos.test`, role: 'USER', plan: 'FREE', businesses: [{ businessId: business.id, role: 'OWNER' }] },
    businessId: business.id,
    productId: product.id,
  }
}

const actAs = (user: SessionUser) => vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(user)
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function upload(bytes: Uint8Array, name = 'foto') {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], name))
  return new NextRequest('http://localhost/api/products/x/image', { method: 'POST', body: form })
}
const get = (query = '', headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/imagenes/producto/x${query}`, { headers })

let A: Tenant
let B: Tenant

beforeAll(async () => {
  A = await createTenant('a')
  B = await createTenant('b')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fotos de productos: subir, ver y quitar', () => {
  it('el dueño sube una foto, aparece en su catálogo y se sirve con las defensas puestas', async () => {
    actAs(A.user)
    const res = await imageRoute.POST(upload(PNG), ctx(A.productId))
    expect(res.status).toBe(200)
    const { imageVersion } = await res.json()
    expect(imageVersion).toEqual(expect.any(Number))

    const catalog = await (await catalogRoute.GET(new NextRequest('http://localhost/x'), ctx(A.businessId))).json()
    expect(catalog.products[0].imageVersion).toBe(imageVersion)

    // La dirección pública no necesita sesión: Meta la baja sin cookies.
    vi.restoreAllMocks()
    const served = await publicImageRoute.GET(get(`?v=${imageVersion}`), ctx(A.productId))
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/png')
    expect(served.headers.get('x-content-type-options')).toBe('nosniff')
    expect(served.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(served.headers.get('cache-control')).toContain('immutable')
    expect(Buffer.from(await served.arrayBuffer()).equals(Buffer.from(PNG))).toBe(true)

    const etag = served.headers.get('etag')!
    const cached = await publicImageRoute.GET(get('', { 'if-none-match': etag }), ctx(A.productId))
    expect(cached.status).toBe(304)
  })

  it('guarda el tipo según los bytes, no según el nombre que mande el navegador', async () => {
    actAs(A.user)
    await imageRoute.POST(upload(JPEG, 'engañosa.png'), ctx(A.productId))
    vi.restoreAllMocks()
    const served = await publicImageRoute.GET(get(), ctx(A.productId))
    expect(served.headers.get('content-type')).toBe('image/jpeg')
  })

  it('rechaza un HTML disfrazado de foto y no deja nada guardado', async () => {
    const otro = await store.addProduct({ businessId: A.businessId, name: 'Completo', price: 3000, stock: null })
    actAs(A.user)
    const res = await imageRoute.POST(upload(html('<script>alert(1)</script>'), 'foto.jpg'), ctx(otro.id))
    expect(res.status).toBe(400)
    expect(await prisma.productImage.count({ where: { productId: otro.id } })).toBe(0)
  })

  it('rechaza una imagen que pasa el tope de peso', async () => {
    const otro = await store.addProduct({ businessId: A.businessId, name: 'Churrasco', price: 6000, stock: null })
    const grande = new Uint8Array(MAX_IMAGE_BYTES + 1)
    grande.set(JPEG)
    actAs(A.user)
    const res = await imageRoute.POST(upload(grande), ctx(otro.id))
    expect(res.status).toBe(413)
    expect(await prisma.productImage.count({ where: { productId: otro.id } })).toBe(0)
  })

  it('cambiar la foto reemplaza la anterior en vez de sumar otra', async () => {
    actAs(A.user)
    await imageRoute.POST(upload(PNG), ctx(A.productId))
    await imageRoute.POST(upload(WEBP), ctx(A.productId))
    expect(await prisma.productImage.count({ where: { productId: A.productId } })).toBe(1)
  })

  it('otra empresa no puede subir, reemplazar ni borrar la foto', async () => {
    actAs(A.user)
    await imageRoute.POST(upload(PNG), ctx(A.productId))
    const antes = await prisma.productImage.findUnique({ where: { productId: A.productId } })

    actAs(B.user)
    expect((await imageRoute.POST(upload(JPEG), ctx(A.productId))).status).toBe(404)
    expect((await imageRoute.DELETE(new Request('http://localhost/x', { method: 'DELETE' }), ctx(A.productId))).status).toBe(404)

    const despues = await prisma.productImage.findUnique({ where: { productId: A.productId } })
    expect(Buffer.from(despues!.data).equals(Buffer.from(antes!.data))).toBe(true)
  })

  it('sin sesión no se puede subir', async () => {
    vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(null)
    expect((await imageRoute.POST(upload(PNG), ctx(A.productId))).status).toBe(401)
  })

  it('quitar la foto la borra y el catálogo deja de mostrarla', async () => {
    actAs(A.user)
    await imageRoute.POST(upload(PNG), ctx(A.productId))
    expect((await imageRoute.DELETE(new Request('http://localhost/x', { method: 'DELETE' }), ctx(A.productId))).status).toBe(200)

    const catalog = await (await catalogRoute.GET(new NextRequest('http://localhost/x'), ctx(A.businessId))).json()
    const producto = catalog.products.find((p: { id: string }) => p.id === A.productId)
    expect(producto.imageVersion).toBeNull()
    vi.restoreAllMocks()
    expect((await publicImageRoute.GET(get(), ctx(A.productId))).status).toBe(404)
  })

  it('borrar el producto borra también su foto', async () => {
    const efimero = await store.addProduct({ businessId: A.businessId, name: 'Efímero', price: 1000, stock: null })
    actAs(A.user)
    await imageRoute.POST(upload(PNG), ctx(efimero.id))
    await store.deleteProduct(efimero.id)
    expect(await prisma.productImage.count({ where: { productId: efimero.id } })).toBe(0)
  })
})
