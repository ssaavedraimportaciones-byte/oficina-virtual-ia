'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatPrice, isSoldOut } from '@/lib/catalog'
import { resizeForUpload } from '@/lib/imageResize'
import type { Order, OrderStatus, PaymentStatus, Product, SalesSettings } from '@/lib/types'
import ImportCatalog from './ImportCatalog'
import ImportCatalogFile from './ImportCatalogFile'
import StepIntro from '../StepIntro'
import SalesSettingsPanel from './SalesSettingsPanel'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pendiente: 'text-amber-400 border-amber-500/40',
  entregado: 'text-success border-success/40',
  cancelado: 'text-gray-500 border-gray-700',
}

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; style: string } | null> = {
  no_aplica: null,
  esperando: { label: '⏳ Esperando pago', style: 'text-amber-300 border-amber-500/40' },
  revisar: { label: '👀 Dice que pagó: revisa tu cuenta', style: 'text-sky-300 border-sky-500/50 bg-sky-500/10' },
  pagado: { label: '✓ Pagado', style: 'text-emerald-400 border-emerald-500/40' },
  vencido: { label: 'No pagó a tiempo', style: 'text-gray-500 border-gray-700' },
}

/**
 * El stock se edita en local y se guarda al salir del campo o con Enter: guardar en cada
 * tecla mandaba un pedido y recargaba todo el catálogo por dígito, y una respuesta atrasada
 * podía pisar lo que el dueño estaba escribiendo.
 */
function StockInput({ stock, onSave }: { stock: number | null; onSave: (stock: number | null) => void }) {
  const [value, setValue] = useState(stock === null ? '' : String(stock))
  const commit = () => {
    const next = value.trim() === '' ? null : Math.max(0, Math.floor(Number(value)))
    if (next !== null && !Number.isFinite(next)) return setValue(stock === null ? '' : String(stock))
    if (next !== stock) onSave(next)
  }
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      Stock
      <input
        type="number"
        min={0}
        value={value}
        placeholder="∞"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="input w-20"
      />
    </label>
  )
}

export default function PedidosPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId

  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [sales, setSales] = useState<SalesSettings | null>(null)
  const [food, setFood] = useState(false)
  /** Unidades que alcanza la materia prima, por producto con receta (si usa inventario). */
  const [portions, setPortions] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [saving, setSaving] = useState(false)
  // Foto en curso (id del producto) y último error, para mostrar algo útil si falla.
  const [uploading, setUploading] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${businessId}/catalogo`)
    if (res.ok) {
      const data = await res.json()
      setProducts(data.products ?? [])
      setOrders(data.orders ?? [])
      setSales(data.sales ?? null)
      setFood(Boolean(data.food))
      setPortions(data.portions ?? {})
    }
    setLoading(false)
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  async function patchProduct(id: string, update: Partial<Product>) {
    await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    await load()
  }

  async function uploadImage(productId: string, file: File) {
    setUploading(productId)
    setImageError(null)
    try {
      const blob = await resizeForUpload(file)
      const form = new FormData()
      form.append('file', blob, 'foto')
      const res = await fetch(`/api/products/${productId}/image`, { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setImageError(data.error ?? 'No se pudo subir la foto.')
      }
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'No se pudo subir la foto.')
    }
    setUploading(null)
    await load()
  }

  async function removeImage(productId: string) {
    await fetch(`/api/products/${productId}/image`, { method: 'DELETE' })
    await load()
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/businesses/${businessId}/catalogo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price: Number(price),
        // Vacío = sin control de stock: el producto nunca se agota solo.
        stock: stock.trim() === '' ? null : Number(stock),
      }),
    })
    setSaving(false)
    setName('')
    setPrice('')
    setStock('')
    await load()
  }

  async function removeProduct(id: string) {
    if (!window.confirm('¿Eliminar este producto del catálogo?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    await load()
  }

  async function confirmPaid(id: string) {
    if (!window.confirm('¿Ya viste la plata en tu cuenta? El pedido pasa a cocina y le avisamos al cliente.')) return
    await fetch(`/api/orders/${id}/pago`, { method: 'POST' })
    await load()
  }

  async function setStatus(id: string, status: OrderStatus) {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  if (loading) {
    return <div className="px-8 py-12 text-gray-500">Cargando…</div>
  }

  const noIngredients = (p: Product) => portions[p.id] === 0
  const soldOut = products.filter((p) => p.active && (isSoldOut(p) || noIngredients(p)))
  const pending = orders.filter((o) => o.status === 'pendiente')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      {products.length === 0 && (
        <StepIntro
          businessId={businessId}
          step="operacion"
          why="Sube tu carta o catálogo con precios (y stock si quieres). Con eso el agente recomienda, toma el pedido, calcula el total y descuenta el stock."
          next={{ href: `/panel/${businessId}`, label: 'Probar a tu agente' }}
        />
      )}
      <h1 className="text-2xl font-bold text-white">Catálogo y pedidos</h1>
      <p className="mt-2 text-sm text-gray-400">
        El agente consulta este catálogo antes de confirmar precios, y descuenta el stock cuando
        registra un pedido.
      </p>

      {products.length === 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-gray-300">
          Hasta que cargues productos, el agente no puede tomar pedidos: va a anotar lo que pide
          el cliente y decir que se lo confirma a la brevedad.
        </div>
      )}

      {soldOut.length > 0 && (
        <div className="mt-6 rounded-lg border border-danger/40 bg-danger/5 p-5">
          <h2 className="text-sm font-medium text-danger">
            {soldOut.length === 1 ? 'Producto agotado' : `${soldOut.length} productos agotados`}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            El agente ya dejó de ofrecerlos y avisa que no hay stock. Actualiza el stock abajo
            {Object.keys(portions).length > 0 && (
              <>
                {' '}o registra la compra de materia prima en{' '}
                <Link href={`/panel/${businessId}/inventario`} className="text-amber-300 hover:text-amber-200">
                  Inventario y costos
                </Link>
              </>
            )}{' '}
            para volver a venderlos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {soldOut.map((product) => (
              <span
                key={product.id}
                className="rounded-full border border-danger/40 px-3 py-1 text-xs text-danger"
              >
                {product.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {sales && <SalesSettingsPanel businessId={businessId} initial={sales} onSaved={setSales} food={food} />}

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Productos</h2>
        <p className="mt-1 text-xs text-gray-500">
          Deja el stock vacío si no quieres llevar control: ese producto nunca se agota solo.
        </p>

        <p className="mt-1 text-xs text-gray-500">
          Puedes subir una foto de cada producto (desde el celular o el computador): se reduce sola
          para que cargue rápido.
        </p>
        {imageError && <p className="mt-2 text-sm text-danger">{imageError}</p>}

        {products.length > 0 && (
          <div className="mt-4 flex flex-col divide-y divide-gray-800 rounded-md border border-gray-800">
            {products.map((product) => {
              const agotado = isSoldOut(product) || noIngredients(product)
              return (
                <div
                  key={product.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 ${product.active ? '' : 'opacity-50'}`}
                >
                  <label
                    title={product.imageVersion ? 'Cambiar foto' : 'Subir foto'}
                    className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-700 text-center text-[10px] leading-tight text-gray-500 hover:border-amber-500 hover:text-amber-400"
                  >
                    {product.imageVersion ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/imagenes/producto/${product.id}?v=${product.imageVersion}`}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{uploading === product.id ? 'Subiendo…' : '+ Foto'}</span>
                    )}
                    {uploading === product.id && product.imageVersion && (
                      <span className="absolute inset-0 flex items-center justify-center bg-gray-950/70 text-[10px] text-white">
                        Subiendo…
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) uploadImage(product.id, file)
                      }}
                    />
                  </label>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{product.name}</span>
                      {agotado && product.active && (
                        <span className="rounded-full border border-danger/50 px-2 py-0.5 text-[10px] font-medium uppercase text-danger">
                          Agotado
                        </span>
                      )}
                      {!product.active && (
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase text-gray-500">
                          Pausado
                        </span>
                      )}
                      {product.active && portions[product.id] > 0 && (
                        <span
                          title="Lo que alcanza tu materia prima (Inventario y costos)"
                          className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase text-gray-400"
                        >
                          Alcanza para {portions[product.id]}
                        </span>
                      )}
                      {!agotado &&
                        product.active &&
                        sales?.stockAlertsEnabled &&
                        product.stock !== null &&
                        product.stock <= sales.stockAlertThreshold && (
                          <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-400">
                            Quedan {product.stock}
                          </span>
                        )}
                    </div>
                    <div className="text-xs text-gray-500">{formatPrice(product.price)}</div>
                  </div>

                  <StockInput
                    key={`${product.id}-${product.stock}`}
                    stock={product.stock}
                    onSave={(stock) => patchProduct(product.id, { stock })}
                  />

                  {product.imageVersion && (
                    <button
                      onClick={() => removeImage(product.id)}
                      className="text-xs text-gray-500 hover:text-danger"
                    >
                      Quitar foto
                    </button>
                  )}
                  <button
                    onClick={() => patchProduct(product.id, { active: !product.active })}
                    className="text-xs text-gray-400 hover:text-amber-400"
                  >
                    {product.active ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="text-xs text-gray-500 hover:text-danger"
                  >
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <form onSubmit={addProduct} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Producto, ej: Torta de chocolate"
            className="input flex-1"
          />
          <input
            required
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Precio"
            className="input sm:w-28"
          />
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Stock"
            className="input sm:w-24"
          />
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
          >
            {saving ? 'Agregando…' : 'Agregar'}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-800 pt-5">
          <p className="text-sm font-medium text-gray-200">¿Tienes varios productos? Carga todos de una vez</p>
          <p className="mt-1 text-xs text-gray-500">
            Lo más simple: una foto de tu carta con el celular. También sirve un PDF o un Excel/CSV si ya los
            tienes.
          </p>
          <ImportCatalogFile businessId={businessId} onImported={load} />
          <ImportCatalog businessId={businessId} onImported={load} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-white">
          Pedidos ({pending.length} pendiente{pending.length === 1 ? '' : 's'})
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay pedidos.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-gray-800 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-white">{order.contactName}</div>
                    <div className="text-xs text-gray-500">{order.contactHandle}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[order.status]}`}>
                      {order.status}
                    </span>
                    {PAYMENT_BADGE[order.paymentStatus] && order.status !== 'cancelado' && (
                      <span className={`rounded-full border px-3 py-1 text-xs ${PAYMENT_BADGE[order.paymentStatus]!.style}`}>
                        {PAYMENT_BADGE[order.paymentStatus]!.label}
                      </span>
                    )}
                    {order.paymentStatus === 'vencido' && order.status === 'cancelado' && (
                      <span className="text-xs text-gray-500">Se anuló por no pagar a tiempo</span>
                    )}
                  </div>
                </div>

                <ul className="mt-3 flex flex-col gap-0.5 text-sm text-gray-300">
                  {order.items.map((item) => (
                    <li key={item.productId}>
                      {item.quantity}× {item.name} —{' '}
                      <span className="text-gray-500">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.note && (
                  <p className="mt-2 text-sm text-gray-500">Nota: {order.note}</p>
                )}

                {order.receiptCheck && order.status !== 'cancelado' && (
                  <div
                    className={`mt-3 rounded-md border p-3 text-sm ${
                      order.receiptCheck.verdict === 'coincide'
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : order.receiptCheck.verdict === 'no_coincide'
                          ? 'border-danger/50 bg-danger/5'
                          : 'border-amber-500/40 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-white">
                        🧾 Comprobante:{' '}
                        {
                          {
                            coincide: 'calza con el pedido',
                            dudoso: 'faltan datos por ver',
                            no_coincide: 'NO calza',
                            ilegible: 'no se pudo leer',
                          }[order.receiptCheck.verdict]
                        }
                      </span>
                      <a
                        href={`/api/orders/${order.id}/comprobante`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-300 hover:text-amber-200"
                      >
                        Ver imagen ↗
                      </a>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1 text-xs">
                      {order.receiptCheck.items.map((i) => (
                        <li key={i.label} className={i.ok === false ? 'text-red-300' : i.ok ? 'text-gray-300' : 'text-gray-500'}>
                          {i.ok === true ? '✓' : i.ok === false ? '✗' : '?'} {i.label}: {i.detail}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-gray-500">
                      Revisión automática: ayuda, pero una imagen editada puede pasar. Confirma cuando veas la plata en tu cuenta.
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-400">
                    Total {formatPrice(order.total)}
                  </span>
                  {order.status === 'pendiente' && (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {(order.paymentStatus === 'esperando' || order.paymentStatus === 'revisar') && (
                        <button
                          onClick={() => confirmPaid(order.id)}
                          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-emerald-400"
                        >
                          Pago recibido
                        </button>
                      )}
                      <button
                        onClick={() => setStatus(order.id, 'entregado')}
                        className="text-xs text-gray-400 hover:text-success"
                      >
                        Marcar entregado
                      </button>
                      <button
                        onClick={() => setStatus(order.id, 'cancelado')}
                        className="text-xs text-gray-500 hover:text-danger"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-gray-600">
          Cancelar un pedido devuelve las unidades al stock.
        </p>
      </section>
    </div>
  )
}
