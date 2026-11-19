'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { INDUSTRY_TEMPLATES, type IndustryTemplate } from '@/lib/industries'
import {
  AGENT_NAME_IDEAS,
  CHANNEL_CHOICES,
  TONE_CHOICES,
  WIZARD_STEPS,
  stepProblems,
  type WizardForm,
} from '@/lib/newBusiness'

const EMPTY: WizardForm = {
  businessName: '',
  industry: '',
  description: '',
  agentName: '',
  goals: '',
  tone: 'cercano',
  channels: ['whatsapp'],
}

function Label({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-200">{title}</span>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
      {children}
    </label>
  )
}

/**
 * Crear un negocio en tres pasos: tu empresa, tu agente y dónde atiende. Al
 * terminar la persona queda dentro del panel de ese negocio, con la guía de
 * primeros pasos para enseñarle al agente lo que tiene que saber.
 */
export default function NuevoWizard({ firstTime }: { firstTime: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<IndustryTemplate | null>(null)
  const [form, setForm] = useState<WizardForm>(EMPTY)
  const [showMore, setShowMore] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ text: string; upgrade: boolean } | null>(null)

  const current = WIZARD_STEPS[step]
  const set = (patch: Partial<WizardForm>) => setForm((f) => ({ ...f, ...patch }))

  function pickTemplate(t: IndustryTemplate) {
    setTemplate(t)
    // Las demás respuestas parten de lo que ya sabemos de ese rubro.
    setForm((f) => ({ ...f, industry: t.industry, description: t.description, goals: t.goals, tone: t.tone }))
    setProblems([])
  }

  function next() {
    const missing = template ? stepProblems(current.id, form) : ['Elige primero a qué rubro pertenece tu negocio.']
    setProblems(missing)
    if (missing.length > 0) return
    setStep((s) => s + 1)
    window.scrollTo({ top: 0 })
  }

  function back() {
    setProblems([])
    setStep((s) => Math.max(0, s - 1))
  }

  async function create() {
    const missing = stepProblems('canales', form)
    setProblems(missing)
    if (missing.length > 0 || !template) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: template.id,
        config: {
          agentName: form.agentName.trim(),
          businessName: form.businessName.trim(),
          industry: form.industry.trim(),
          description: form.description.trim(),
          goals: form.goals.trim(),
          tone: form.tone,
          channels: form.channels,
        },
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(
        res.status === 402
          ? { text: typeof data.error === 'string' ? data.error : 'Tu plan no permite más negocios.', upgrade: true }
          : { text: 'No pudimos crear el negocio. Revisa los datos e inténtalo de nuevo.', upgrade: false },
      )
      return
    }
    const { business } = await res.json()
    router.push(`/panel/${business.id}/primeros-pasos`)
  }

  const toneLabel = TONE_CHOICES.find((t) => t.value === form.tone)?.label

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      {!firstTime && (
        <Link href="/panel" className="text-sm text-gray-500 hover:text-gray-300">
          ← Volver
        </Link>
      )}

      <p className={`${firstTime ? '' : 'mt-4 '}text-sm font-medium text-amber-400`}>
        {firstTime ? '👋 Te damos la bienvenida' : 'Nuevo negocio'}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
        {firstTime ? 'Creemos a tu agente en 3 pasos' : 'Crea el agente de tu nuevo negocio'}
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        Son unos 2 minutos. Después entras al panel de tu negocio, donde le enseñas lo que tiene que saber. Todo se puede
        cambiar más adelante.
      </p>

      {/* Dónde voy */}
      <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Pasos">
        {WIZARD_STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i < step ? 'bg-amber-500/70' : i === step ? 'bg-amber-400' : 'bg-gray-800'}`} />
            <p className={`mt-2 text-xs font-semibold uppercase tracking-wide ${i === step ? 'text-amber-300' : 'text-gray-500'}`}>
              Paso {i + 1}
            </p>
            <p className={`text-sm ${i === step ? 'text-white' : 'text-gray-500'}`}>{s.title}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/30 p-5 sm:p-7">
        {/* ---------- Paso 1 ---------- */}
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white">¿A qué se dedica tu negocio?</h2>
              <p className="mt-1 text-sm text-gray-400">Elige el rubro y tu agente parte sabiendo qué preguntar.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {INDUSTRY_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTemplate(t)}
                    aria-pressed={template?.id === t.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left ${
                      template?.id === t.id ? 'border-amber-400 bg-amber-500/10' : 'border-gray-800 hover:border-amber-500/50'
                    }`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {t.emoji}
                    </span>
                    <span className="text-sm font-medium text-white">{t.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">¿No ves el tuyo? Elige «Otro» y lo describes tú.</p>
            </div>

            {template && (
              <>
                <Label title="¿Cómo se llama tu negocio?" hint="Así lo van a ver tus clientes.">
                  <input
                    value={form.businessName}
                    onChange={(e) => set({ businessName: e.target.value })}
                    className="input"
                    placeholder="Estudio de uñas Bella"
                    autoFocus
                  />
                </Label>

                <button type="button" onClick={() => setShowMore((v) => !v)} className="w-fit text-sm text-amber-300 hover:text-amber-200">
                  {showMore ? '▾ Ocultar' : '▸ Ver o ajustar'} lo que sabemos de tu rubro
                </button>
                {showMore && (
                  <>
                    <Label title="A qué se dedica" hint="En pocas palabras.">
                      <input value={form.industry} onChange={(e) => set({ industry: e.target.value })} className="input" />
                    </Label>
                    <Label title="Cuéntanos de tu negocio" hint="Es lo primero que lee tu agente: qué haces, dónde estás, qué te diferencia.">
                      <textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} className="input" />
                    </Label>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ---------- Paso 2 ---------- */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Conoce a tu agente</h2>
              <p className="mt-1 text-sm text-gray-400">Es quien va a contestar a tus clientes. Ponle nombre, elige cómo habla y dile qué tiene que lograr.</p>
            </div>

            <Label title="¿Cómo se llama?" hint="Con nombre de persona, tus clientes conversan más tranquilos.">
              <input value={form.agentName} onChange={(e) => set({ agentName: e.target.value })} className="input" placeholder="Sofía" autoFocus />
              <span className="flex flex-wrap gap-2 pt-1">
                {AGENT_NAME_IDEAS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ agentName: n })}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-amber-500 hover:text-amber-300"
                  >
                    {n}
                  </button>
                ))}
              </span>
            </Label>

            <div>
              <span className="text-sm font-medium text-gray-200">¿Cómo habla?</span>
              <div className="mt-2 flex flex-col gap-2">
                {TONE_CHOICES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set({ tone: t.value })}
                    aria-pressed={form.tone === t.value}
                    className={`rounded-lg border px-4 py-3 text-left ${form.tone === t.value ? 'border-amber-400 bg-amber-500/10' : 'border-gray-800 hover:border-amber-500/50'}`}
                  >
                    <span className="block text-sm font-medium text-white">{t.label}</span>
                    <span className="mt-1 block text-sm italic text-gray-400">«{t.example}»</span>
                  </button>
                ))}
              </div>
            </div>

            <Label title="¿Qué tiene que lograr?" hint="Escríbelo como se lo explicarías a alguien nuevo en tu equipo. Ya lo dejamos pensado para tu rubro: ajústalo si quieres.">
              <textarea rows={5} value={form.goals} onChange={(e) => set({ goals: e.target.value })} className="input" />
            </Label>
          </div>
        )}

        {/* ---------- Paso 3 ---------- */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white">¿Dónde va a atender?</h2>
              <p className="mt-1 text-sm text-gray-400">
                Elige los canales. Si todavía no tienes tu WhatsApp o Instagram listo, no pasa nada: lo conectas después y
                mientras tanto lo pruebas en el simulador.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {CHANNEL_CHOICES.map((c) => {
                  const on = form.channels.includes(c.value)
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ channels: on ? form.channels.filter((x) => x !== c.value) : [...form.channels, c.value] })}
                      className={`flex-1 rounded-lg border px-4 py-3 text-left ${on ? 'border-amber-400 bg-amber-500/10' : 'border-gray-800 hover:border-amber-500/50'}`}
                    >
                      <span className="block text-sm font-medium text-white">{on ? '✓ ' : ''}{c.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-400">{c.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 p-4 text-sm">
              <p className="font-medium text-white">Así queda tu agente</p>
              <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr]">
                <dt className="text-gray-500">Negocio</dt>
                <dd className="text-gray-200">
                  {template?.emoji} {form.businessName}
                </dd>
                <dt className="text-gray-500">Agente</dt>
                <dd className="text-gray-200">
                  {form.agentName}, {toneLabel?.toLowerCase()}
                </dd>
                <dt className="text-gray-500">Atiende en</dt>
                <dd className="text-gray-200">{form.channels.map((c) => CHANNEL_CHOICES.find((x) => x.value === c)?.label).join(' y ') || '—'}</dd>
              </dl>
              <p className="mt-3 text-xs text-gray-500">Lo siguiente: en tu panel lo guiamos para enseñarle tus precios, horarios y todo lo que tiene que saber.</p>
            </div>
          </div>
        )}

        {problems.length > 0 && (
          <ul className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-200" role="alert">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="mt-5 rounded-md border border-danger/50 bg-danger/5 p-3 text-sm text-danger" role="alert">
            {error.text}{' '}
            {error.upgrade && (
              <Link href="/account" className="underline">
                Ver mi plan
              </Link>
            )}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={back} className="rounded-md border border-gray-700 px-5 py-2.5 text-sm text-gray-200 hover:border-gray-500">
              ← Atrás
            </button>
          ) : (
            <span />
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <button type="button" onClick={next} className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-gray-950 hover:bg-amber-400">
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? 'Creando tu agente…' : 'Crear mi agente'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
