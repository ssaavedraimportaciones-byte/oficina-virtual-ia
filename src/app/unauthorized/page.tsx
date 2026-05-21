import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-950 border border-red-800 mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Sin acceso</h1>
        <p className="text-gray-400 mb-6">
          No tienes permisos para ver esta página. Contacta a tu administrador si crees que es un error.
        </p>
        <Link
          href="/"
          className="inline-block bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
