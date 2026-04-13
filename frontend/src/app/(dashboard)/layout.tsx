"use client"

import Link from "next/link"
import { Sidebar } from "@/components/ui/Sidebar"
import { useProfile } from "@/hooks/useProfile"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, loading } = useProfile()
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <div className="flex h-screen bg-surface selection:bg-primary-fixed selection:text-primary overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopNav / Header */}
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-surface-container/50 flex items-center justify-between px-10 relative z-20">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-surface-container rounded-lg">
              <span className="material-symbols-outlined text-on-surface-variant">search</span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Buscando en patio...</p>
          </div>

          <Link href="/perfil" className="flex items-center gap-6 hover:bg-surface-container/30 p-2 px-4 rounded-2xl transition-all group">
            <div className="flex flex-col items-end">
              {loading ? (
                <div className="h-4 w-32 bg-surface-container animate-pulse rounded" />
              ) : (
                <>
                  <p className="text-sm font-bold text-on-surface leading-none group-hover:text-primary transition-colors">
                    {profile?.full_name || 'Usuario'}
                  </p>
                  <p className="text-[10px] font-black tracking-widest text-primary/60 uppercase">
                    {profile?.role_name || 'Sin Rol'}
                  </p>
                </>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold shadow-elevated group-hover:scale-105 transition-transform">
              {loading ? '...' : getInitials(profile?.full_name || 'U')}
            </div>
          </Link>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-10 bg-surface">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
