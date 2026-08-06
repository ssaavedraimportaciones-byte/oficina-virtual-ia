import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/panel', label: 'Conversaciones' },
  { href: '/panel/configurar', label: 'Configurar agente' },
  { href: '/panel/conexiones', label: 'Conexiones' },
]

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-gray-800 bg-gray-900/40 p-6">
        <Link href="/" className="font-mono text-lg font-semibold text-amber-400">
          AgentsApp
        </Link>
        <nav className="mt-10 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  )
}
