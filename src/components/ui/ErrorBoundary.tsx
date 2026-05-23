'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '@/lib/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  context?: string
}

interface State {
  hasError: boolean
  message: string | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { action: this.props.context ?? 'ErrorBoundary' })
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  handleReset = () => this.setState({ hasError: false, message: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="bg-red-950 border border-red-800 rounded-xl p-6 text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="text-red-300 font-medium">Ocurrió un error inesperado</p>
          <p className="text-red-400 text-sm">
            {this.props.context ? `Módulo: ${this.props.context}` : 'Intente recargar la página.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 text-red-200 rounded-lg transition-colors"
            >
              Reintentar
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Ir al dashboard
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
