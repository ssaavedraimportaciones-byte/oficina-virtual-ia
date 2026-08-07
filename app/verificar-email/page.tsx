import VerifyEmailPanel from './VerifyEmailPanel'

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-8">
      <VerifyEmailPanel token={token ?? null} />
    </div>
  )
}
