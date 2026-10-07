'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Calculadora de ahorro: cuánto tiempo (y plata) devuelve el agente, con los
 * números de cada negocio. No es una promesa: es una cuenta transparente que
 * cada uno ajusta. Los resultados suben animados, como un contador.
 */

/** Jornada completa en Chile (42 h semanales desde abril de 2026) ≈ 180 h al mes. */
const JORNADA_MES = 180
const DIAS_MES = 30

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const dec1 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const int = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })

/** Valor que persigue a `target` con una curva suave (contador). */
function useTween(target: number, ms = 650) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  const shown = useRef(target)
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calm) {
      shown.current = target
      setValue(target)
      return
    }
    from.current = shown.current
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      shown.current = from.current + (target - from.current) * e
      setValue(shown.current)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

function Slider({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="zv-calc-field">
      <div className="zv-calc-row">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="zv-calc-val">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      {hint && <p className="zv-calc-hint">{hint}</p>}
    </div>
  )
}

export default function Ahorro() {
  const [msgs, setMsgs] = useState(40)
  const [mins, setMins] = useState(3)
  const [share, setShare] = useState(60)
  const [cost, setCost] = useState(4000)

  const hours = (msgs * DIAS_MES * mins * (share / 100)) / 60
  const people = hours / JORNADA_MES
  const money = hours * cost

  // Al entrar en pantalla, los resultados cuentan desde cero (el HTML del servidor
  // ya trae los valores reales; solo se «arma» en cero si todavía no se ve).
  const ref = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(true)
  const [intro, setIntro] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) return
    setArmed(false)
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setArmed(true)
        setIntro(true)
        window.setTimeout(() => setIntro(false), 1500)
        io.disconnect()
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Entrada: conteo largo; después, al mover los controles, respuesta ágil
  const ms = !armed ? 1 : intro ? 1400 : 450
  const tHours = useTween(armed ? hours : 0, ms)
  const tPeople = useTween(armed ? people : 0, ms)
  const tMoney = useTween(armed ? money : 0, ms)

  return (
    <div className="zv-calc" data-reveal-item ref={ref}>
      <div className="zv-calc-in">
        <p className="zv-calc-kick">Haz la cuenta con tus números</p>
        <Slider id="zv-calc-msgs" label="Mensajes que te llegan al día" value={msgs} min={5} max={300} step={5} format={(v) => int.format(v)} onChange={setMsgs} />
        <Slider
          id="zv-calc-mins"
          label="Minutos que toma responder cada uno"
          value={mins}
          min={1}
          max={10}
          step={0.5}
          format={(v) => `${dec1.format(v)} min`}
          onChange={setMins}
        />
        <Slider
          id="zv-calc-share"
          label="Parte que el agente resuelve solo"
          hint="Supuesto: depende de tu rubro y de cuánta información le cargues."
          value={share}
          min={20}
          max={90}
          step={5}
          format={(v) => `${v}%`}
          onChange={setShare}
        />
        <div className="zv-calc-field">
          <div className="zv-calc-row">
            <label htmlFor="zv-calc-cost">Costo por hora de quien responde</label>
          </div>
          <div className="zv-calc-money">
            <span aria-hidden="true">$</span>
            <input
              id="zv-calc-cost"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={cost}
              onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))}
            />
            <span className="zv-calc-unit">CLP / hora</span>
          </div>
        </div>
      </div>

      <div className="zv-calc-out">
        {/* Para lectores de pantalla: el resultado final, sin los números intermedios del conteo */}
        <p className="zv-sr" aria-live="polite">
          {`Recuperas cerca de ${int.format(hours)} horas al mes, ${dec1.format(people)} de una persona a jornada completa, unos ${clp.format(Math.round(money / 1000) * 1000)} al mes en tiempo de trabajo.`}
        </p>
        <div className="zv-calc-big" aria-hidden="true">
          <span className="zv-calc-num">{tHours >= 10 ? int.format(tHours) : dec1.format(tHours)}</span>
          <span className="zv-calc-lab">horas al mes que tu equipo deja de pasar contestando</span>
        </div>
        <div className="zv-calc-pair" aria-hidden="true">
          <div>
            <span className="zv-calc-num zv-calc-num--sm">{dec1.format(tPeople)}</span>
            <span className="zv-calc-lab">de una persona a jornada completa</span>
          </div>
          <div>
            <span className="zv-calc-num zv-calc-num--sm">{clp.format(Math.round(tMoney / 1000) * 1000)}</span>
            <span className="zv-calc-lab">al mes en tiempo de trabajo</span>
          </div>
        </div>
        <p className="zv-calc-note">
          Estimación con los números que tú pones (mes de {DIAS_MES} días; jornada completa ≈ {JORNADA_MES} h al mes). No es una promesa: el
          resultado real depende de tu negocio.
        </p>
      </div>
    </div>
  )
}
