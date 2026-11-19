import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBusiness, getSetupFacts } from '@/lib/store'
import { getSetupProgress, type SetupStep } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

function StepCard({ step, n, current }: { step: SetupStep; n: number; current: boolean }) {
  return (
    <li
      className={`rounded-xl border p-5 sm:p-6 ${
        current
          ? 'border-amber-400/70 bg-amber-500/[0.07] shadow-[0_0_0_4px_rgba(245,158,11,0.08)]'
          : step.done
            ? 'border-emerald-500/25 bg-emerald-500/[0.03]'
            : 'border-gray-800 bg-gray-900/30'
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            step.done
              ? 'bg-emerald-500 text-gray-950'
              : current
                ? 'bg-amber-400 text-gray-950'
                : 'bg-gray-800 text-gray-300'
          }`}
          aria-hidden="true"
        >
          {step.done ? '✓' : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{step.title}</h2>
            {step.done && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">Listo</span>
            )}
            {current && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Sigue este</span>
            )}
            {step.optional && !step.done && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">Opcional</span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-300">{step.why}</p>

          {current && step.tips.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 rounded-lg bg-gray-950/60 p-4 text-sm text-gray-300">
              {step.tips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-amber-400" aria-hidden="true">
                    →
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={step.href}
            className={`mt-4 inline-block rounded-md px-5 py-2.5 text-sm font-semibold ${
              current
                ? 'bg-amber-500 text-gray-950 hover:bg-amber-400'
                : 'border border-gray-700 text-gray-200 hover:border-amber-500 hover:text-amber-300'
            }`}
          >
            {step.done ? 'Revisar' : step.cta} →
          </Link>
        </div>
      </div>
    </li>
  )
}

export default async function PrimerosPasosPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const [business, facts] = await Promise.all([getBusiness(businessId), getSetupFacts(businessId)])
  if (!business || !facts) notFound()

  const progress = getSetupProgress(businessId, facts)
  const agentName = business.config.agentName
  const pct = Math.round((progress.completed / progress.required) * 100)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-medium text-amber-400">🚀 Primeros pasos</p>
      <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
        {progress.ready ? `¡${agentName} está listo para atender!` : `Dejemos a ${agentName} listo para atender`}
      </h1>
      <p className="mt-2 text-gray-400">
        {progress.ready
          ? 'Ya responde con tu información, agenda o toma pedidos y avisa cuando algo necesita a una persona. Puedes volver a cualquier paso para mejorarlo.'
          : 'Son pocos pasos y cada uno se marca solo cuando lo completas. Sigue el que está destacado: te decimos por qué importa y cómo hacerlo bien.'}
      </p>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">
            {progress.completed} de {progress.required} pasos listos
          </span>
          <span className="font-semibold text-amber-300">{pct}%</span>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-800"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="mt-8 flex flex-col gap-4">
        {progress.steps.map((step, i) => (
          <StepCard key={step.id} step={step} n={i + 1} current={progress.next?.id === step.id} />
        ))}
      </ol>

      <div className="mt-10 rounded-xl border border-gray-800 p-5 text-sm text-gray-400">
        <p className="font-medium text-gray-200">¿Cómo funciona tu agente?</p>
        <ul className="mt-3 flex flex-col gap-2">
          <li>💬 Responde cada mensaje de WhatsApp e Instagram en segundos, a cualquier hora.</li>
          <li>📚 Usa solo lo que le enseñaste: si no sabe algo, no lo inventa y dice que lo confirma.</li>
          <li>📅 Agenda horas, toma pedidos o reserva mesas, y lo deja registrado en tu panel.</li>
          <li>
            🙋 Si un cliente reclama o pide una persona, se pausa y te avisa. Tú respondes desde «Conversaciones».
          </li>
          <li>
            ✍️ Puedes entrar a cualquier conversación y escribir tú. Para que el agente vuelva a atender, aprieta
            «Devolverle al agente» en esa conversación.
          </li>
        </ul>
      </div>
    </div>
  )
}
