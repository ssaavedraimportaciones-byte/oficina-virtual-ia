import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import './globals.css'

function siteUrl(): URL {
  try {
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    return new URL(process.env.NEXT_PUBLIC_URL || (vercel ? `https://${vercel}` : 'http://localhost:3000'))
  } catch {
    return new URL('http://localhost:3000')
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: `${BRAND.name} — ${BRAND.tagline}. Agentes de IA para WhatsApp e Instagram`,
  description:
    'Un agente de IA que atiende tu WhatsApp e Instagram al tiro: responde, agenda horas, toma pedidos y te pasa el caso cuando hace falta una persona. Para cualquier rubro.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* Antes de pintar: si se permite el movimiento, la landing arma su escenario animado; si no, queda la versión estática. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js-motion')}catch(e){}",
          }}
        />
      </head>
      <body className="bg-gray-950 text-gray-50 antialiased">{children}</body>
    </html>
  )
}
