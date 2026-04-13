export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-container-light/30 flex flex-col items-center">
      {/* App-like top bar */}
      <header className="w-full bg-surface/80 backdrop-blur-md sticky top-0 z-50 border-b border-outline-variant/30 flex items-center justify-center h-14">
        <h1 className="text-primary font-black font-headline tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined filled">local_shipping</span>
          MasterIsimo <span className="text-on-surface">Portería</span>
        </h1>
      </header>
      
      <main className="w-full max-w-md flex-1 p-4 flex flex-col">
        {children}
      </main>

      {/* Simple footer */}
      <footer className="w-full max-w-md text-center py-6 text-on-surface-variant text-xs">
        <p>MasterIsimo CEDI &copy; {new Date().getFullYear()}</p>
        <p className="mt-1 opacity-70">Desarrollo Exclusivo</p>
      </footer>
    </div>
  )
}
