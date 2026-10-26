import Link from 'next/link'
import { BrandLockup } from '@/app/BrandMark'
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
      <Link href="/" className="inline-flex">
        <BrandLockup size={22} className="text-base" />
      </Link>

      <h1 className="mt-10 text-3xl font-bold text-white">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">Última actualización: {updated}</p>

      <div className="prose prose-invert mt-10 max-w-none text-sm leading-relaxed text-gray-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>

      {/* El texto está escrito con los datos reales de la sociedad, pero no lo
          revisó un abogado: decirlo acá es más honesto que dar a entender lo
          contrario con el silencio. */}
      <p className="mt-12 border-t border-gray-800 pt-6 text-xs text-gray-600">
        Este documento informa cómo funciona el servicio y no constituye asesoramiento legal.
      </p>
    </main>
  )
}
