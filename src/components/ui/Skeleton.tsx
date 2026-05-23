'use client'

interface Props {
  className?: string
  lines?: number
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />
}

export function SkeletonCard({ lines = 3 }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
      <SkeletonLine className="h-3 w-1/4" />
      <SkeletonLine className="h-5 w-3/4" />
      {lines > 2 && <SkeletonLine className="h-4 w-1/2" />}
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
