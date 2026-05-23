'use client'

import Link from 'next/link'

interface Action {
  label: string
  href?: string
  onClick?: () => void
}

interface Props {
  icon?: string
  title: string
  description?: string
  action?: Action
  className?: string
}

export default function EmptyState({ icon = '📂', title, description, action, className = '' }: Props) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-10 text-center ${className}`}
    >
      <p className="text-4xl mb-3" role="img" aria-hidden>
        {icon}
      </p>
      <p className="text-white font-medium">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="text-sm text-amber-400 hover:text-amber-300 underline transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="text-sm text-amber-400 hover:text-amber-300 underline transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
