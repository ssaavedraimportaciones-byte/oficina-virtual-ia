import Link from "next/link";

/** Orden de los pasos para armar el agente (ver lib/onboarding.ts). */
const FLOW = [
  { id: "perfil", path: "configurar", label: "Quién es y cómo habla" },
  { id: "conocimiento", path: "conocimiento", label: "Lo que sabe" },
  { id: "operacion", path: null, label: "Servicios o carta" },
  { id: "prueba", path: "", label: "Pruébalo" },
  { id: "canal", path: "conexiones", label: "Dónde atiende" },
] as const;

type FlowId = (typeof FLOW)[number]["id"];

/**
 * Encabezado de guía en las pantallas para armar el agente: en qué paso va,
 * para qué sirve lo que está por hacer y cuál viene después.
 */
export default function StepIntro({
  businessId,
  step,
  why,
  next,
}: {
  businessId: string;
  step: FlowId;
  why: string;
  /** El siguiente paso, si conviene sugerirlo. */
  next?: { href: string; label: string };
}) {
  const i = FLOW.findIndex((s) => s.id === step);
  return (
    <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Paso {i + 1} de {FLOW.length} · {FLOW[i].label}
        </p>
        <Link
          href={`/panel/${businessId}/primeros-pasos`}
          className="text-xs text-gray-400 hover:text-amber-300"
        >
          Ver la guía completa
        </Link>
      </div>
      <ol className="mt-3 flex gap-1.5" aria-hidden="true">
        {FLOW.map((s, k) => (
          <li
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${k < i ? "bg-amber-500/60" : k === i ? "bg-amber-400" : "bg-gray-800"}`}
          />
        ))}
      </ol>
      <p className="mt-3 text-sm text-gray-300">{why}</p>
      {next && (
        <Link
          href={next.href}
          className="mt-3 inline-block text-sm font-medium text-amber-300 hover:text-amber-200"
        >
          Cuando termines, sigue con: {next.label} →
        </Link>
      )}
    </div>
  );
}
