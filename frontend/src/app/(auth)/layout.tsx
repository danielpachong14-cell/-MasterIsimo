export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dot-grid">
      <div className="w-full max-w-[1200px] flex flex-col items-center">
        {children}
      </div>
    </div>
  )
}
