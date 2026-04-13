"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as Accordion from "@radix-ui/react-accordion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { MENU_CONFIG, Role } from "@/config/menu"
import { useUIStore } from "@/store/uiStore"
import { createClient } from "@/lib/supabase/client"
import { ScheduleSupplierModal } from "@/components/ui/ScheduleSupplierModal"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<Role | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { openAccordionIds, toggleAccordion, isSidebarCollapsed, toggleSidebar } = useUIStore()
  const supabase = createClient()

  useEffect(() => {
    async function fetchRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role_id')
            .eq('id', session.user.id)
            .single()
            
          if (profile) {
            const mappedRole = profile.role_id === 1 ? 'SuperAdmin' : 
                               profile.role_id === 2 ? 'Coordinador' : null
            setUserRole(mappedRole as Role)
          }
        }
      } catch (e) {
        console.error("Error fetching user role", e)
      } finally {
        setLoadingRole(false)
      }
    }
    fetchRole()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <aside 
        className={cn(
          "flex flex-col relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.87,0,0.13,1)]",
          isSidebarCollapsed ? "w-[90px]" : "w-[300px]"
        )} 
        style={{ backgroundColor: '#381368' }}
      >
        {/* Botón Flotante para Colapsar */}
        <button
          onClick={toggleSidebar}
          className="absolute top-7 right-[-14px] z-50 bg-white text-[#381368] rounded-full p-1 shadow-elevated border border-white/20 transition-transform hover:scale-110"
        >
          <span className={cn(
            "material-symbols-outlined text-sm transition-transform duration-300",
            isSidebarCollapsed ? "rotate-180" : ""
          )}>
            chevron_left
          </span>
        </button>

        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 blur-[80px] pointer-events-none" />
        
        {/* Brand Section */}
        <div className={cn(
          "py-8 px-6 space-y-2 relative z-10 border-b border-white/10 transition-all duration-300",
          isSidebarCollapsed ? "px-0 items-center flex flex-col" : ""
        )}>
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-elevated shrink-0 relative overflow-hidden">
              <span className="material-symbols-outlined text-[#381368] text-xl font-bold font-icon">inventory</span>
            </div>
            
            <h1 className={cn(
              "text-xl font-black font-headline text-white tracking-tight transition-all duration-300 whitespace-nowrap overflow-hidden origin-left",
              isSidebarCollapsed ? "w-0 opacity-0 scale-x-0" : "w-auto opacity-100 scale-x-100"
            )}>
              MasterIsimo
            </h1>
          </div>

          <p className={cn(
            "text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase transition-all duration-300 overflow-hidden whitespace-nowrap",
            isSidebarCollapsed ? "w-0 opacity-0 h-0" : "w-full pl-1 opacity-100 h-auto"
          )}>
            CEDI Management v4
          </p>
        </div>

        {/* Agendar Proveedor Action */}
        <div className={cn(
          "px-4 pt-6 relative z-10 transition-all duration-300",
          isSidebarCollapsed ? "px-2" : ""
        )}>
          <Button
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "w-full bg-white text-[#381368] hover:bg-white/90 shadow-elevated group relative overflow-hidden rounded-xl h-11 transition-all duration-300 flex items-center",
              isSidebarCollapsed ? "justify-center p-0 w-11 h-11 mx-auto" : "justify-start px-4"
            )}
          >
            <span className="material-symbols-outlined text-lg shrink-0 group-hover:scale-110 transition-transform">
              calendar_add_on
            </span>
            <span className={cn(
              "font-bold text-sm tracking-wide transition-all duration-300 whitespace-nowrap ml-3",
              isSidebarCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
            )}>
              Agendar Proveedor
            </span>
          </Button>
        </div>

        {/* Navigation Accordion */}
      <nav className="flex-1 px-4 py-8 overflow-y-auto relative z-10 no-scrollbar">
        {loadingRole ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <Accordion.Root
            type="multiple"
            value={openAccordionIds}
            onValueChange={() => {}} // Controlled manually via headers to sync with Zustand
            className="space-y-4"
          >
            {MENU_CONFIG.map((group) => {
              // Filter items by role
              const allowedItems = group.items.filter(item => 
                userRole && item.roles.includes(userRole)
              );

              // Don't render group if no items are allowed
              if (allowedItems.length === 0) return null;

              return (
                  <Accordion.Item 
                    key={group.id} 
                    value={group.id} 
                    className={cn(
                      "rounded-2xl overflow-hidden transition-colors",
                      isSidebarCollapsed ? "bg-transparent mx-2" : "bg-black/10 mx-0"
                    )}
                  >
                    <Accordion.Header>
                      <Accordion.Trigger 
                        onClick={() => toggleAccordion(group.id)}
                        className={cn(
                          "w-full flex items-center text-white/70 hover:text-white hover:bg-white/5 transition-colors group py-4",
                          isSidebarCollapsed ? "justify-center px-0 rounded-xl" : "justify-between px-5 rounded-none"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "material-symbols-outlined text-lg",
                            isSidebarCollapsed && openAccordionIds.includes(group.id) ? "text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" : ""
                          )}>{group.icon}</span>
                          <span className={cn(
                            "text-sm font-bold tracking-wide uppercase transition-all duration-300 whitespace-nowrap",
                            isSidebarCollapsed ? "w-0 opacity-0 overflow-hidden hidden" : "w-auto opacity-100"
                          )}>{group.label}</span>
                        </div>
                        <span className={cn(
                          "material-symbols-outlined transition-all duration-300 ease-[cubic-bezier(0.87,0,0.13,1)] group-data-[state=open]:rotate-180",
                          isSidebarCollapsed ? "hidden w-0" : "flex w-auto"
                        )}>
                          expand_more
                        </span>
                      </Accordion.Trigger>
                    </Accordion.Header>
                    {!isSidebarCollapsed && (
                      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <div className="px-3 pb-3 pt-1 space-y-1">
                          {allowedItems.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                            return (
                              <Link key={item.href} href={item.href}>
                                <div className={cn(
                                  "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative",
                                  isActive 
                                    ? "bg-white text-[#381368] shadow-lg font-bold" 
                                    : "text-white/60 hover:text-white hover:bg-white/10 font-medium"
                                )}>
                                  {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-tertiary-fixed rounded-r-full" />
                                  )}
                                  <span className={cn(
                                    "material-symbols-outlined text-base transition-transform duration-300 group-hover:scale-110"
                                  )}>
                                    {item.icon}
                                  </span>
                                  <span className="text-sm tracking-tight">{item.label}</span>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      </Accordion.Content>
                    )}
                  </Accordion.Item>
              )
            })}
          </Accordion.Root>
        )}
      </nav>

      {/* Footer Info */}
      <div className={cn(
        "m-4 p-5 rounded-2xl space-y-4 transition-all duration-300",
        isSidebarCollapsed ? "p-0 mx-2 bg-transparent space-y-6 flex flex-col items-center" : "bg-black/20"
      )}>
        <div className={cn(
          "space-y-1 transition-all",
          isSidebarCollapsed ? "space-y-0" : ""
        )}>
          <p className={cn(
            "text-[10px] font-bold tracking-widest text-white/50 uppercase transition-all duration-300",
            isSidebarCollapsed ? "hidden opacity-0 w-0" : "block opacity-100"
          )}>Estado Sistema</p>
          <div className={cn(
            "flex items-center",
            isSidebarCollapsed ? "justify-center" : "gap-2"
          )}>
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse shrink-0" />
            <p className={cn(
              "text-xs font-medium text-white transition-all duration-300 whitespace-nowrap overflow-hidden",
              isSidebarCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
            )}>Operativo (Norte-1)</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className={cn(
            "text-white/40 hover:text-white hover:bg-red-500/20 transition-colors duration-300 relative group overflow-hidden",
            isSidebarCollapsed ? "w-10 h-10 p-0 justify-center mx-auto" : "w-full justify-start px-3"
          )}
        >
          <span className={cn(
            "material-symbols-outlined",
            isSidebarCollapsed ? "m-0" : "mr-2"
          )}>logout</span>
          <span className={cn(
            "transition-all duration-300 whitespace-nowrap",
            isSidebarCollapsed ? "opacity-0 w-0 hidden" : "opacity-100"
          )}>
            Cerrar Sesión
          </span>
        </Button>
      </div>
    </aside>

    {/* Modal rendering outside logic to keep hierarchy safe */}
    <ScheduleSupplierModal 
      isOpen={isModalOpen} 
      onClose={() => setIsModalOpen(false)} 
    />
  </>
  )
}
