'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleClick} disabled={busy} className={className}>
      {busy ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}
