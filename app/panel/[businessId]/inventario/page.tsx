'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Unit = 'unidad' | 'g' | 'kg' | 'ml' | 'l'
const UNITS: Unit[] = ['unidad', 'g', 'kg', 'ml', 'l']
const UNIT_LABEL: Record<Unit, string> = { unidad: 'unidades', g: 'g', kg: 'kg', ml: 'ml', l: 'litros' }
const UNIT_SHORT: Record<Unit, string> = { unidad: 'u', g: 'g', kg: 'kg', ml: 'ml', l: 'l' }

interface Ingredient {
  id: string
  name: string
  unit: Unit
  stock: number
  unitCost: number
  minStock: number
}
interface ProductCost {
  id: string
  name: string
  price: number
  active: boolean
  cost: number | null
  portions: number | null
  recipe: { ingredientId: string; quantity: number }[]
}
interface Report {
  revenue: number
  orders: number
  costOfSales: number
  revenueWithRecipe: number
  purchases: number
  shrinkage: number
  stockValue: number
}
interface Movement {
  id: string
  ingredientName: string
  unit: Unit
  kind: 'compra' | 'consumo' | 'anulacion' | 'ajuste'
  quantity: number
  unitCost: number
  orderId: string | null
  note: string
  createdAt: string
}

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`
const qty = (n: number, u: Unit) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 3 })} ${UNIT_SHORT[u]}`
/** Acepta «0,08» o «0.08» y miles con punto («1.500»). */
function parseNum(v: string): number {
  const t = v.trim().replace(/\s/g, '')
  if (!t) return NaN
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t
  return Number(normalized)
}
const costPerUnitLabel = (i: Ingredient) => `${clp(i.unitCost)} / ${UNIT_SHORT[i.unit]}`

const KIND_LABEL: Record<Movement['kind'], string> = {
  compra: 'Compra',
  consumo: 'Venta',
  anulacion: 'Pedido anulado',
  ajuste: 'Ajuste',
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border border-gray-800 p-4">
      <div className={`text-xl font-bold ${tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-danger' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

export default function InventarioPage() {
  const { businessId } = useParams<{ businessId: string }>()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [products, setProducts] = useState<ProductCost[]>([])
  const [report, setReport] = useState<{ month: Report; today: Report } | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${businessId}/inventario`)
    if (res.ok) {
      const d = await res.json()
      setEnabled(d.enabled)
      setIngredients(d.ingredients)
      setProducts(d.products)
      setReport(d.report)
      setMovements(d.movements)
    }
    setLoading(false)
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  async function act(body: Record<string, unknown>, okText: string): Promise<boolean> {
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/businesses/${businessId}/inventario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? 'No se pudo guardar.' })
      return false
    }
    setMsg({ ok: true, text: okText })
    await load()
    return true
  }

  async function enable() {
    setBusy(true)
    const res = await fetch(`/api/businesses/${businessId}/ventas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientsEnabled: true }),
    })
    setBusy(false)
    // El menú del panel se arma en el servidor: se recarga para que aparezca.
    if (res.ok) window.location.reload()
  }

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])
  const out = ingredients.filter((i) => i.stock <= 0)
  const low = ingredients.filter((i) => i.stock > 0 && i.minStock > 0 && i.stock <= i.minStock)
  const stopped = products.filter((p) => p.active && p.portions === 0)

  if (loading) return <div className="px-4 py-8 text-sm text-gray-500 sm:px-8">Cargando…</div>

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-bold text-white">Inventario y costos</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-400">
        Carga tu materia prima y la receta de cada producto. Cada venta descuenta lo que usa, cada pedido anulado lo
        devuelve, y el agente deja de ofrecer lo que no alcanzas a preparar. Así cuadran el inventario, lo que te cuesta
        cada producto y lo que ganas.
      </p>

      {!enabled && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-gray-300">
          <p>
            El inventario de materia prima está apagado: el agente vende con el stock de cada producto, como siempre.
            Actívalo cuando quieras empezar a cargar ingredientes y recetas.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={enable}
            className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            Activar inventario de materia prima
          </button>
        </div>
      )}

      {report && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Este mes</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Ventas" value={clp(report.month.revenue)} hint={`${report.month.orders} pedidos · hoy ${clp(report.today.revenue)}`} />
            <Stat
              label="Costo de la materia prima vendida"
              value={clp(report.month.costOfSales)}
              hint={`hoy ${clp(report.today.costOfSales)}`}
            />
            <Stat
              label="Ganancia bruta (productos con receta)"
              value={clp(report.month.revenueWithRecipe - report.month.costOfSales)}
              hint={
                report.month.revenueWithRecipe > 0
                  ? `${Math.round(((report.month.revenueWithRecipe - report.month.costOfSales) / report.month.revenueWithRecipe) * 100)}% de lo vendido con receta`
                  : 'Arma las recetas para calcularla'
              }
              tone={report.month.revenueWithRecipe - report.month.costOfSales >= 0 ? 'good' : 'bad'}
            />
            <Stat label="Compras de mercadería" value={clp(report.month.purchases)} />
            <Stat label="Merma y ajustes" value={clp(report.month.shrinkage)} tone={report.month.shrinkage > 0 ? 'bad' : undefined} />
            <Stat label="Inventario a costo, hoy" value={clp(report.month.stockValue)} />
          </div>
        </section>
      )}

      {(out.length > 0 || low.length > 0) && (
        <div className="mt-6 rounded-lg border border-danger/40 bg-danger/5 p-5">
          <h2 className="text-sm font-medium text-danger">Reponer</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-300">
            {out.map((i) => (
              <li key={i.id}>
                <strong className="text-white">{i.name}</strong>: se acabó
              </li>
            ))}
            {low.map((i) => (
              <li key={i.id}>
                <strong className="text-white">{i.name}</strong>: quedan {qty(i.stock, i.unit)} (mínimo {qty(i.minStock, i.unit)})
              </li>
            ))}
          </ul>
          {stopped.length > 0 && (
            <p className="mt-3 text-sm text-gray-400">
              El agente dejó de ofrecer: {stopped.map((p) => p.name).join(', ')}. Vuelven solos cuando registres la compra.
            </p>
          )}
        </div>
      )}

      {msg && <p className={`mt-4 text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}

      <IngredientsSection ingredients={ingredients} busy={busy} act={act} />
      <RecipesSection products={products} ingredients={ingredients} byId={byId} busy={busy} act={act} businessId={businessId} />

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Movimientos recientes</h2>
        <p className="mt-1 text-xs text-gray-500">Cada entrada y salida de materia prima, para revisar de dónde sale cada número.</p>
        {movements.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Todavía no hay movimientos.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-normal">Fecha</th>
                  <th className="py-2 pr-3 font-normal">Movimiento</th>
                  <th className="py-2 pr-3 font-normal">Ingrediente</th>
                  <th className="py-2 pr-3 text-right font-normal">Cantidad</th>
                  <th className="py-2 text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 text-gray-500">
                      {new Date(m.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-3">
                      {KIND_LABEL[m.kind]}
                      {m.note && <span className="block text-xs text-gray-500">{m.note}</span>}
                    </td>
                    <td className="py-2 pr-3">{m.ingredientName}</td>
                    <td className={`py-2 pr-3 text-right ${m.quantity < 0 ? 'text-gray-400' : 'text-emerald-400'}`}>
                      {m.quantity > 0 ? '+' : ''}
                      {qty(m.quantity, m.unit)}
                    </td>
                    <td className="py-2 text-right">{clp(Math.abs(m.quantity * m.unitCost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

type Act = (body: Record<string, unknown>, okText: string) => Promise<boolean>

function IngredientsSection({ ingredients, busy, act }: { ingredients: Ingredient[]; busy: boolean; act: Act }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('unidad')
  const [stock, setStock] = useState('')
  const [total, setTotal] = useState('')
  const [min, setMin] = useState('')
  const [open, setOpen] = useState<{ id: string; mode: 'compra' | 'conteo' } | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const s = stock ? parseNum(stock) : 0
    const t = total ? parseNum(total) : 0
    const m = min ? parseNum(min) : 0
    if ([s, t, m].some((n) => Number.isNaN(n) || n < 0)) return
    const ok = await act({ action: 'add', name, unit, stock: s, totalCost: t, minStock: m }, `«${name.trim()}» agregado.`)
    if (ok) {
      setName('')
      setStock('')
      setTotal('')
      setMin('')
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-800 p-6">
      <h2 className="font-medium text-white">Materia prima</h2>
      <p className="mt-1 text-xs text-gray-500">
        Cuando compres, usa «Registrar compra» con lo que dice la boleta: suma al stock y actualiza el costo promedio.
        «Contar» es para dejar el stock como está en la bodega (merma, lo que se botó).
      </p>

      {ingredients.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-800">
          {ingredients.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{i.name}</p>
                  <p className="text-xs text-gray-500">
                    Costo {costPerUnitLabel(i)} · mínimo {qty(i.minStock, i.unit)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      i.stock <= 0
                        ? 'border-danger/40 text-danger'
                        : i.minStock > 0 && i.stock <= i.minStock
                          ? 'border-amber-500/40 text-amber-300'
                          : 'border-gray-700 text-gray-300'
                    }`}
                  >
                    {i.stock <= 0 ? 'Agotado' : qty(i.stock, i.unit)}
                  </span>
                  <button type="button" onClick={() => setOpen({ id: i.id, mode: 'compra' })} className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:border-amber-500">
                    Registrar compra
                  </button>
                  <button type="button" onClick={() => setOpen({ id: i.id, mode: 'conteo' })} className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:border-amber-500">
                    Contar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`¿Borrar «${i.name}»? Se quita de las recetas y se borra su historial de movimientos.`)) {
                        act({ action: 'delete', ingredientId: i.id }, `«${i.name}» borrado.`)
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-danger"
                  >
                    Borrar
                  </button>
                </div>
              </div>
              {open?.id === i.id && <MoveForm ingredient={i} mode={open.mode} busy={busy} act={act} onDone={() => setOpen(null)} />}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-5 grid gap-3 rounded-md border border-gray-800 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-gray-400 lg:col-span-2">
          Ingrediente
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Palta, Pan de completo, Salmón" className="input" required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Se mide en
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="input">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Tienes ahora
          <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="decimal" placeholder="0" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Pagaste por eso ($)
          <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="numeric" placeholder="0" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Avisar bajo
          <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="0" className="input" />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-fit rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50 lg:col-span-6"
        >
          Agregar ingrediente
        </button>
      </form>
    </section>
  )
}

function MoveForm({ ingredient, mode, busy, act, onDone }: { ingredient: Ingredient; mode: 'compra' | 'conteo'; busy: boolean; act: Act; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [total, setTotal] = useState('')
  const [note, setNote] = useState('')
  const u = UNIT_LABEL[ingredient.unit]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const a = parseNum(amount)
    if (Number.isNaN(a) || a < 0) return
    const ok =
      mode === 'compra'
        ? await act(
            { action: 'purchase', ingredientId: ingredient.id, quantity: a, totalCost: parseNum(total || '0'), note },
            `Compra de ${ingredient.name} registrada.`,
          )
        : await act({ action: 'adjust', ingredientId: ingredient.id, stock: a, note }, `Stock de ${ingredient.name} actualizado.`)
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-gray-800 bg-gray-900/40 p-3">
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        {mode === 'compra' ? `Compraste (${u})` : `Hay en bodega (${u})`}
        <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="input" style={{ width: '8rem' }} required />
      </label>
      {mode === 'compra' && (
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Pagaste en total ($)
          <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="numeric" className="input" style={{ width: '9rem' }} required />
        </label>
      )}
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-gray-400">
        Nota (opcional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === 'compra' ? 'Ej.: boleta 1234, Lider' : 'Ej.: se pusieron negras'}
          className="input"
        />
      </label>
      <button type="submit" disabled={busy} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50">
        Guardar
      </button>
      <button type="button" onClick={onDone} className="px-2 py-2 text-sm text-gray-400 hover:text-white">
        Cancelar
      </button>
    </form>
  )
}

function RecipesSection({
  products,
  ingredients,
  byId,
  busy,
  act,
  businessId,
}: {
  products: ProductCost[]
  ingredients: Ingredient[]
  byId: Map<string, Ingredient>
  busy: boolean
  act: Act
  businessId: string
}) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <section className="mt-6 rounded-lg border border-gray-800 p-6">
      <h2 className="font-medium text-white">Recetas y costo por producto</h2>
      <p className="mt-1 text-xs text-gray-500">
        Indica cuánto de cada ingrediente lleva una unidad. Los productos sin receta (por ejemplo, una bebida en lata) se
        siguen vendiendo con su stock de{' '}
        <Link href={`/panel/${businessId}/pedidos`} className="text-amber-300 hover:text-amber-200">
          Catálogo y pedidos
        </Link>
        .
      </p>
      {products.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Primero carga tus productos en Catálogo y pedidos.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-800">
          {products.map((p) => {
            const margin = p.cost === null ? null : p.price - p.cost
            return (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-medium ${p.active ? 'text-white' : 'text-gray-500'}`}>{p.name}</p>
                    <p className="text-xs text-gray-500">
                      Precio {clp(p.price)}
                      {p.cost !== null && (
                        <>
                          {' '}· costo {clp(p.cost)} ·{' '}
                          <span className={margin! >= 0 ? 'text-emerald-400' : 'text-danger'}>
                            ganas {clp(margin!)} ({p.price > 0 ? Math.round((margin! / p.price) * 100) : 0}%)
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.portions !== null && (
                      <span className={`rounded-full border px-3 py-1 text-xs ${p.portions === 0 ? 'border-danger/40 text-danger' : 'border-gray-700 text-gray-300'}`}>
                        {p.portions === 0 ? 'No alcanza' : `Alcanza para ${p.portions}`}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(editing === p.id ? null : p.id)}
                      className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:border-amber-500"
                    >
                      {p.recipe.length ? 'Editar receta' : 'Armar receta'}
                    </button>
                  </div>
                </div>
                {p.recipe.length > 0 && editing !== p.id && (
                  <p className="mt-1 text-xs text-gray-500">
                    {p.recipe
                      .map((r) => {
                        const ing = byId.get(r.ingredientId)
                        return ing ? `${qty(r.quantity, ing.unit)} ${ing.name}` : null
                      })
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {editing === p.id && (
                  <RecipeEditor product={p} ingredients={ingredients} busy={busy} act={act} onDone={() => setEditing(null)} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RecipeEditor({ product, ingredients, busy, act, onDone }: { product: ProductCost; ingredients: Ingredient[]; busy: boolean; act: Act; onDone: () => void }) {
  const [lines, setLines] = useState(
    product.recipe.length ? product.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: String(r.quantity).replace('.', ',') })) : [{ ingredientId: '', quantity: '' }],
  )
  if (ingredients.length === 0) return <p className="mt-3 text-sm text-gray-500">Primero agrega tu materia prima arriba.</p>

  const set = (i: number, patch: Partial<{ ingredientId: string; quantity: string }>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  async function save() {
    const clean = lines.filter((l) => l.ingredientId && l.quantity).map((l) => ({ ingredientId: l.ingredientId, quantity: parseNum(l.quantity) }))
    if (clean.some((l) => Number.isNaN(l.quantity) || l.quantity <= 0)) return
    if (await act({ action: 'recipe', productId: product.id, lines: clean }, `Receta de ${product.name} guardada.`)) onDone()
  }

  return (
    <div className="mt-3 rounded-md border border-gray-800 bg-gray-900/40 p-3">
      <p className="text-xs text-gray-400">Para 1 {product.name}:</p>
      <div className="mt-2 flex flex-col gap-2">
        {lines.map((l, i) => {
          const ing = ingredients.find((x) => x.id === l.ingredientId)
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={l.quantity}
                onChange={(e) => set(i, { quantity: e.target.value })}
                inputMode="decimal"
                placeholder="Cantidad"
                className="input"
                style={{ width: '7rem' }}
              />
              <span className="w-14 text-xs text-gray-500">{ing ? UNIT_LABEL[ing.unit] : ''}</span>
              <select value={l.ingredientId} onChange={(e) => set(i, { ingredientId: e.target.value })} className="input" style={{ width: 'auto', minWidth: '12rem' }}>
                <option value="">Elige ingrediente…</option>
                {ingredients.map((x) => (
                  <option key={x.id} value={x.id} disabled={lines.some((o, j) => j !== i && o.ingredientId === x.id)}>
                    {x.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-xs text-gray-500 hover:text-danger">
                Quitar
              </button>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => setLines([...lines, { ingredientId: '', quantity: '' }])} className="text-sm text-amber-300 hover:text-amber-200">
          + Otro ingrediente
        </button>
        <button type="button" disabled={busy} onClick={save} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50">
          Guardar receta
        </button>
        <button type="button" onClick={onDone} className="px-2 py-2 text-sm text-gray-400 hover:text-white">
          Cancelar
        </button>
      </div>
    </div>
  )
}
