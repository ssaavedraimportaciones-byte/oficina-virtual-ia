export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {children}
    </main>
  )
}
