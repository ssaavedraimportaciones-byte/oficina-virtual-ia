'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatPrice, isSoldOut } from '@/lib/catalog'
import type { Order, OrderStatus, Product } from '@/lib/types'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pendiente: 'text-amber-400 border-amber-500/40',
  entregado: 'text-success border-success/40',
  cancelado: 'text-gray-500 border-gray-700',
}

export default function PedidosPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId

  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${businessId}/catalogo`)
    if (res.ok) {
      const data = await res.json()
      setProducts(data.products ?? [])
      setOrders(data.orders ?? [])
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

  const soldOut = products.filter((p) => p.active && isSoldOut(p))
  const pending = orders.filter((o) => o.status === 'pendiente')

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
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
            El agente ya dejó de ofrecerlos y avisa que no hay stock. Reponé abajo para volver a
            venderlos.
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

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Productos</h2>
        <p className="mt-1 text-xs text-gray-500">
          Dejá el stock vacío si no querés llevar control: ese producto nunca se agota solo.
        </p>

        {products.length > 0 && (
          <div className="mt-4 flex flex-col divide-y divide-gray-800 rounded-md border border-gray-800">
            {products.map((product) => {
              const agotado = isSoldOut(product)
              return (
                <div
                  key={product.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 ${product.active ? '' : 'opacity-50'}`}
                >
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
                    </div>
                    <div className="text-xs text-gray-500">{formatPrice(product.price)}</div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    Stock
                    <input
                      type="number"
                      min={0}
                      value={product.stock ?? ''}
                      placeholder="∞"
                      onChange={(e) =>
                        patchProduct(product.id, {
                          stock: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="input w-20"
                    />
                  </label>

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
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[order.status]}`}
                  >
                    {order.status}
                  </span>
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

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-400">
                    Total {formatPrice(order.total)}
                  </span>
                  {order.status === 'pendiente' && (
                    <div className="flex gap-3">
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
