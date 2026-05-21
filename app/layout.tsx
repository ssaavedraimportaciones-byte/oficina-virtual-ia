import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SafeCheck AI',
  description: 'Documentos de seguridad para faenas mineras',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-gray-50 antialiased">{children}</body>
    </html>
  )
}
