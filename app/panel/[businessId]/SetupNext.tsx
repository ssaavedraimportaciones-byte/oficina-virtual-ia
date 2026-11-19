import Link from "next/link";
import { getSetupFacts } from "@/lib/store";
import { getSetupProgress } from "@/lib/onboarding";

/**
 * Tarjeta corta con el próximo paso para dejar el agente listo. Desaparece
 * sola cuando ya están todos los pasos obligatorios.
 */
export default async function SetupNext({
  businessId,
}: {
  businessId: string;
}) {
  const facts = await getSetupFacts(businessId);
  if (!facts) return null;
  const progress = getSetupProgress(businessId, facts);
  if (!progress.next) return null;
  const pct = Math.round((progress.completed / progress.required) * 100);

  return (
    <div className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-amber-300">
          🚀 Tu agente: {progress.completed} de {progress.required} pasos listos
        </p>
        <Link
          href={`/panel/${businessId}/primeros-pasos`}
          className="text-xs text-gray-400 hover:text-amber-300"
        >
          Ver todos los pasos →
        </Link>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-4 text-lg font-semibold text-white">
        Siguiente: {progress.next.title}
      </p>
      <p className="mt-1 text-sm text-gray-300">{progress.next.why}</p>
      <Link
        href={progress.next.href}
        className="mt-4 inline-block rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-gray-950 hover:bg-amber-400"
      >
        {progress.next.cta} →
      </Link>
    </div>
  );
}
