import Link from 'next/link'

const ITEMS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/cobros', label: 'Cobros' },
  { href: '/admin/sistema', label: 'Sistema' },
]

/** Navegación entre las pantallas del dueño de la plataforma. */
export default function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mt-6 flex gap-1 border-b border-gray-800">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`-mb-px border-b-2 px-4 py-2 text-sm ${
            item.href === active
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
