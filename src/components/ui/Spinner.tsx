'use client'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-2' }

export default function Spinner({ size = 'md', className = '' }: Props) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block rounded-full border-current border-t-transparent animate-spin ${SIZES[size]} ${className}`}
    />
  )
}
