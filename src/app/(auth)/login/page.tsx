'use client'

import { Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginSchema, type LoginInput } from '@/schemas/auth'
import { useAuth } from '@/contexts/auth-context'
import { ROLE_DEFAULT_ROUTE } from '@/lib/permissions/routes'

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const params = useSearchParams()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginInput) => {
    try {
      const user = await login(data.email, data.password)
      const redirect = params.get('redirect')
      router.push(redirect ?? ROLE_DEFAULT_ROUTE[user.role])
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Error al iniciar sesión' })
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 mb-4">
          <span className="text-2xl font-bold text-gray-950">SC</span>
        </div>
        <h1 className="text-2xl font-bold text-white">SafeCheck AI</h1>
        <p className="text-gray-400 text-sm mt-1">Seguridad documental para faenas mineras</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800"
      >
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Correo electrónico
          </label>
          <input
            type="email"
            {...register('email')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="tu@empresa.cl"
            autoComplete="email"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
          <input
            type="password"
            {...register('password')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {errors.root && (
          <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{errors.root.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold rounded-lg py-2.5 transition-colors"
        >
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
