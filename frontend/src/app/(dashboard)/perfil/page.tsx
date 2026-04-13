"use client"

import { useState, useEffect } from "react"
import { useProfile } from "@/hooks/useProfile"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { createClient } from "@/lib/supabase/client"

export default function ProfilePage() {
  const { profile, sessions, activities, loading, updateProfile, changePassword, fetchSessions, logoutOthers, fetchActivityLog } = useProfile()
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'sessions' | 'activity'>('general')
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
    }
    
    async function getEmail() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)
    }
    getEmail()
  }, [profile, supabase])

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions()
    } else if (activeTab === 'activity') {
      fetchActivityLog()
    }
  }, [activeTab, fetchSessions, fetchActivityLog])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const result = await updateProfile({ full_name: fullName })
    
    if (result.success) {
      setMessage({ text: "Perfil actualizado con éxito", type: 'success' })
    } else {
      setMessage({ text: "Error al actualizar el perfil: " + result.error, type: 'error' })
    }
    setSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwords.new !== passwords.confirm) {
      setMessage({ text: "Las nuevas contraseñas no coinciden", type: 'error' })
      return
    }

    setSaving(true)
    setMessage(null)

    const result = await changePassword(passwords.current, passwords.new)
    
    if (result.success) {
      setMessage({ text: "Contraseña actualizada correctamente", type: 'success' })
      setPasswords({ current: "", new: "", confirm: "" })
    } else {
      setMessage({ text: result.error || "Error al cambiar contraseña", type: 'error' })
    }
    setSaving(false)
  }

  const handleLogoutOthers = async () => {
    if (!confirm("¿Estás seguro de cerrar todas las demás sesiones?")) return
    
    setSaving(true)
    const result = await logoutOthers()
    if (result.success) {
      setMessage({ text: "Otras sesiones cerradas exitosamente", type: 'success' })
    } else {
      setMessage({ text: "Error: " + result.error, type: 'error' })
    }
    setSaving(false)
  }

  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'profile_update': return { icon: 'person_edit', color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'password_change': return { icon: 'lock_reset', color: 'text-orange-500', bg: 'bg-orange-500/10' };
      case 'sessions_logout': return { icon: 'logout', color: 'text-red-500', bg: 'bg-red-500/10' };
      case 'login': return { icon: 'login', color: 'text-green-500', bg: 'bg-green-500/10' };
      default: return { icon: 'info', color: 'text-primary', bg: 'bg-primary/10' };
    }
  }

  const parseUserAgent = (ua: string) => {
    if (!ua) return { browser: "Desconocido", os: "Desconocido", icon: "devices" };
    
    let browser = "Navegador";
    let os = "Desconocido";
    let icon = "devices";

    if (ua.includes("Chrome")) { browser = "Chrome"; icon = "desktop_windows"; }
    else if (ua.includes("Firefox")) { browser = "Firefox"; icon = "desktop_windows"; }
    else if (ua.includes("Safari")) { browser = "Safari"; icon = "desktop_mac"; }
    else if (ua.includes("Edge")) { browser = "Edge"; icon = "desktop_windows"; }

    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Android")) { os = "Android"; icon = "smartphone"; }
    else if (ua.includes("iPhone")) { os = "iPhone"; icon = "smartphone"; }
    else if (ua.includes("Linux")) os = "Linux";

    return { browser, os, icon };
  }

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">Configuración de Usuario</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface uppercase">Mi Perfil</h1>
        </div>
        
        <div className="flex items-center gap-4 bg-surface-container/30 p-3 rounded-2xl border border-surface-container">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-black shadow-elevated">
            {getInitials(fullName)}
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface leading-tight">{fullName || 'Cargando...'}</p>
            <p className="text-[10px] font-black tracking-widest text-primary/60 uppercase">{profile?.role_name || 'Cargando...'}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in zoom-in-95 duration-300 ${
          message.type === 'success' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'
        }`}>
          <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'error'}</span>
          <p className="text-sm font-bold">{message.text}</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="md:col-span-2 space-y-8">
          {activeTab === 'general' && (
            <Card variant="elevated" className="overflow-hidden border-none shadow-float animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="bg-primary/5 px-8 py-5 border-b border-surface-container/50 flex justify-between items-center">
                <h3 className="font-black text-xs uppercase tracking-widest text-primary">Información Personal</h3>
                <span className="text-[10px] font-bold py-1 px-3 bg-primary/10 text-primary rounded-full">Activo</span>
              </div>
              <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60 ml-1">Nombre Completo</label>
                    <Input 
                      value={fullName} 
                      onChange={e => setFullName(e.target.value)} 
                      placeholder="Tu nombre completo"
                      className="bg-surface-container-low/30 focus:bg-white transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60 ml-1">Correo Electrónico</label>
                    <Input 
                      value={email} 
                      disabled 
                      className="bg-surface-container/20 text-on-surface-variant/60 cursor-not-allowed opacity-70"
                    />
                    <p className="text-[9px] text-on-surface-variant/40 ml-1 italic font-medium">El correo no puede ser modificado por seguridad.</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60 ml-1">Rol en el Sistema</label>
                  <div className="flex items-center gap-3 bg-surface-container/20 p-4 rounded-xl border border-surface-container/50">
                    <span className="material-symbols-outlined text-primary/40">verified_user</span>
                    <span className="font-bold text-on-surface text-sm uppercase tracking-tight">{profile?.role_name || 'Cargando...'}</span>
                  </div>
                  <p className="text-[9px] text-on-surface-variant/40 ml-1 italic font-medium">Solo los administradores pueden gestionar permisos de roles.</p>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={saving || fullName === profile?.full_name}
                    className="bg-primary hover:bg-primary/90 text-white shadow-elevated transition-all active:scale-95 px-8"
                  >
                    {saving ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Guardando...</span>
                      </div>
                    ) : 'Verificar y Guardar'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card variant="elevated" className="overflow-hidden border-none shadow-float animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="bg-orange-500/5 px-8 py-5 border-b border-surface-container/50">
                <h3 className="font-black text-xs uppercase tracking-widest text-orange-600">Cambiar Contraseña</h3>
              </div>
              <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60 ml-1">Contraseña Actual</label>
                  <Input 
                    type="password"
                    value={passwords.current} 
                    onChange={e => setPasswords({...passwords, current: e.target.value})} 
                    placeholder="••••••••"
                    required
                    className="bg-surface-container-low/30 focus:bg-white transition-all font-bold"
                  />
                  <p className="text-[9px] text-on-surface-variant/40 ml-1 italic font-medium">Obligatorio para verificar tu identidad.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60 ml-1">Nueva Contraseña</label>
                    <Input 
                      type="password"
                      value={passwords.new} 
                      onChange={e => setPasswords({...passwords, new: e.target.value})} 
                      placeholder="Mínimo 8 caracteres"
                      required
                      className="bg-surface-container-low/30 focus:bg-white transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60 ml-1">Confirmar Nueva Contraseña</label>
                    <Input 
                      type="password"
                      value={passwords.confirm} 
                      onChange={e => setPasswords({...passwords, confirm: e.target.value})} 
                      placeholder="Repite la contraseña"
                      required
                      className="bg-surface-container-low/30 focus:bg-white transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={saving || !passwords.current || !passwords.new}
                    className="bg-orange-600 hover:bg-orange-700 text-white shadow-elevated transition-all active:scale-95 px-8"
                  >
                    {saving ? 'Validando...' : 'Actualizar Credenciales'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-xs uppercase tracking-widest text-primary/60">Sesiones Dispositivos Relacionados</h3>
                <Button 
                  onClick={handleLogoutOthers}
                  variant="secondary" 
                  size="sm"
                  className="text-[10px] font-black uppercase tracking-tighter border-error/30 text-error hover:bg-error/5 h-8"
                >
                  Cerrar otras sesiones
                </Button>
              </div>

              <div className="grid gap-4">
                {sessions.map((session) => {
                  const { browser, os, icon } = parseUserAgent(session.user_agent);
                  return (
                    <Card key={session.id} className={`p-5 flex items-center justify-between border-none shadow-float ${session.is_current ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-white'}`}>
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${session.is_current ? 'bg-primary text-white shadow-elevated' : 'bg-surface-container text-on-surface-variant/60'}`}>
                          <span className="material-symbols-outlined text-2xl">{icon}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-on-surface">{browser} en {os}</h4>
                            {session.is_current && (
                              <span className="text-[9px] font-black uppercase tracking-widest bg-primary text-white px-2 py-0.5 rounded-full">Actual</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tight mt-0.5">
                            IP: {session.ip_address} • {new Date(session.last_sign_in_at).toLocaleString('es-CO', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      {!session.is_current && (
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-xs uppercase tracking-widest text-primary/60">Historial de Actividad</h3>
                <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase">Últimos 20 registros</span>
              </div>

              <Card variant="elevated" className="overflow-hidden border-none shadow-float p-8">
                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-container-highest before:to-transparent">
                  {activities.length > 0 ? (
                    activities.map((activity) => {
                      const { icon, color, bg } = getEventIcon(activity.event_type);
                      return (
                        <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                          {/* Icon circle */}
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${bg} ${color}`}>
                            <span className="material-symbols-outlined text-lg">{icon}</span>
                          </div>
                          {/* Content */}
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-surface-container-low/30 border border-surface-container/50 group-hover:bg-white group-hover:shadow-float transition-all">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                              <time className="font-headline font-black text-[10px] uppercase tracking-tighter text-on-surface-variant/40">
                                {new Date(activity.created_at).toLocaleString('es-CO', { 
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                                })}
                              </time>
                            </div>
                            <div className="text-sm font-bold text-on-surface">{activity.description}</div>
                            {activity.ip_address && (
                              <div className="text-[9px] font-medium text-on-surface-variant/40 mt-1">IP: {activity.ip_address}</div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-sm font-bold text-on-surface-variant/40">No hay actividad registrada aún.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Activity Cards - Visible only in general */}
          {activeTab === 'general' && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card 
                onClick={() => setActiveTab('activity')}
                className="p-6 bg-surface-container-low/40 border-dashed border-2 flex items-center justify-between group hover:border-primary/30 transition-colors cursor-pointer"
              >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-600">
                      <span className="material-symbols-outlined">history</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Actividad Reciente</h4>
                      <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Ver tus acciones</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:text-primary/60 transition-colors">chevron_right</span>
              </Card>

              <Card className="p-6 bg-surface-container-low/40 border-dashed border-2 flex items-center justify-between group hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center text-blue-600">
                      <span className="material-symbols-outlined">help</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Soporte CEDI</h4>
                      <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Obtener ayuda</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:text-primary/60 transition-colors">chevron_right</span>
              </Card>
            </div>
          )}
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          <Card className="p-6 bg-white shadow-float border-none">
            <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-primary/60 mb-6 border-b border-surface-container pb-4">Gestión de Perfil</h4>
            <div className="space-y-3">
              <Button 
                onClick={() => setActiveTab('general')}
                variant={activeTab === 'general' ? 'primary' : 'tertiary'} 
                className={`w-full justify-start gap-3 h-12 ${activeTab === 'general' ? 'bg-primary shadow-elevated' : 'border-surface-container hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'general' ? 'text-white' : 'text-primary'}`}>person</span>
                <span className={`text-xs font-bold ${activeTab === 'general' ? 'text-white' : 'text-on-surface'}`}>Información General</span>
              </Button>
              
              <Button 
                onClick={() => setActiveTab('security')}
                variant={activeTab === 'security' ? 'primary' : 'tertiary'} 
                className={`w-full justify-start gap-3 h-12 shadow-none ${activeTab === 'security' ? 'bg-orange-600 shadow-elevated hover:bg-orange-700' : 'border-surface-container hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'security' ? 'text-white' : 'text-orange-600'}`}>lock_reset</span>
                <span className={`text-xs font-bold ${activeTab === 'security' ? 'text-white' : 'text-on-surface'}`}>Seguridad y Accesos</span>
              </Button>

              <Button 
                onClick={() => setActiveTab('activity')}
                variant={activeTab === 'activity' ? 'primary' : 'tertiary'} 
                className={`w-full justify-start gap-3 h-12 shadow-none ${activeTab === 'activity' ? 'bg-[#381368] shadow-elevated hover:bg-[#2a0e4e]' : 'border-surface-container hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'activity' ? 'text-white' : 'text-[#381368]'}`}>history</span>
                <span className={`text-xs font-bold ${activeTab === 'activity' ? 'text-white' : 'text-on-surface'}`}>Historial de Actividad</span>
              </Button>

              <Button 
                onClick={() => setActiveTab('sessions')}
                variant={activeTab === 'sessions' ? 'primary' : 'tertiary'} 
                className={`w-full justify-start gap-3 h-12 shadow-none ${activeTab === 'sessions' ? 'bg-[#381368] shadow-elevated hover:bg-[#2a0e4e]' : 'border-surface-container hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'sessions' ? 'text-white' : 'text-[#381368]'}`}>devices</span>
                <span className={`text-xs font-bold ${activeTab === 'sessions' ? 'text-white' : 'text-on-surface'}`}>Sesiones Activas</span>
              </Button>
            </div>
          </Card>

          <Card className="p-8 bg-[#381368] text-white relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">workspace_premium</span>
              </div>
              <div>
                <h4 className="font-black text-xl font-headline tracking-tighter uppercase leading-none">Perfil CEDI</h4>
                <p className="text-[10px] font-bold text-white/50 tracking-widest uppercase mt-1">Nivel: {profile?.role_name}</p>
              </div>
              <p className="text-xs text-white/60 leading-relaxed font-medium pt-2">
                Tu perfil está protegido por protocolos de seguridad de grado industrial.
              </p>
            </div>
            {/* Decoration */}
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:bg-white/10 transition-colors" />
          </Card>
        </div>
      </div>
    </div>
  )
}
