import ResetPasswordForm from './ResetPasswordForm'

export default async function RestablecerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-8">
      <ResetPasswordForm token={token ?? null} />
    </div>
  )
}
