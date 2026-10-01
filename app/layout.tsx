import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}. Agentes de IA para WhatsApp e Instagram`,
  description:
    'Un agente de IA que atiende tu WhatsApp e Instagram al tiro: responde, agenda turnos, toma pedidos y te pasa el caso cuando hace falta una persona. Para cualquier rubro.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-gray-50 antialiased">{children}</body>
    </html>
  )
}
