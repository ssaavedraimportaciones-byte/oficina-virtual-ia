import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentsApp — Agentes de IA que convierten chats en ventas',
  description:
    'CRM con agentes de IA que responde WhatsApp e Instagram, califica leads y agenda reuniones. Moldeable a cualquier rubro.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-gray-50 antialiased">{children}</body>
    </html>
  )
}
