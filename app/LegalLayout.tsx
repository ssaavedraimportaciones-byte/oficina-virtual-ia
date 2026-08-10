import Link from 'next/link'

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-mono text-sm font-semibold text-amber-400">
        AgentsApp
      </Link>

      <div className="mt-8 rounded-lg border border-amber-700/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
        <strong>Borrador, no es asesoramiento legal.</strong> Este texto es una plantilla de
        partida generada automáticamente: las secciones entre corchetes hay que completarlas con
        los datos reales del negocio, y conviene que un abogado la revise antes de publicarla,
        sobre todo para cumplir la normativa de protección de datos de cada país/provincia donde
        opere el negocio.
      </div>

      <h1 className="mt-8 text-3xl font-bold text-white">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">Última actualización: {updated}</p>

      <div className="prose prose-invert mt-10 max-w-none text-sm leading-relaxed text-gray-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </main>
  )
}
