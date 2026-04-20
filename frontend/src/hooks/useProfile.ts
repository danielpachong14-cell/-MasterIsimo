"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { UserProfile, UserSession, UserActivityLog } from "@/types"
import { RealtimeChannel } from "@supabase/supabase-js"

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [activities, setActivities] = useState<UserActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setLoading(false)
          return
        }

        const { data, error: profileError } = await supabase
          .from('user_profiles')
          .select(`
            *,
            roles:role_id (name)
          `)
          .eq('id', session.user.id)
          .single()

        if (profileError) throw profileError

        if (data) {
          setProfile({
            ...data,
            role_name: data.roles?.name || 'Usuario'
          })
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        console.error("Error fetching profile:", err)
        setError(err.message || "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()

    // Subscribe to changes in user_profiles
    let channel: RealtimeChannel | null = null;

    async function setupSubscription() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Use a unique name per user to allow multiple hook instances
      channel = supabase
        .channel(`profile-${session.user.id}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_profiles',
          filter: `id=eq.${session.user.id}`
        }, (payload: { new: Partial<UserProfile> }) => {
          setProfile(prev => prev ? { ...prev, ...payload.new } : null)
        })
        .subscribe((status: string, err?: Error) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Perfil suscrito exitosamente')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[Realtime] Error en canal de perfil:', err)
          } else if (status === 'TIMED_OUT') {
            console.warn('[Realtime] Tiempo de espera agotado en canal de perfil')
          }
        })
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      setLoading(true)
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', profile?.id)

      if (updateError) throw updateError
      
      setProfile(prev => prev ? { ...prev, ...updates } : null)
      return { success: true }
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("Error updating profile:", err)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true)
      
      // 1. Verificar contraseña actual intentando loguearse
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error("Usuario no autenticado")

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (loginError) {
        throw new Error("La contraseña actual es incorrecta")
      }

      // 2. Actualizar a la nueva contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      // 3. Loguear actividad manualmente (ya que no hay trigger en auth.users)
      await supabase.from('user_activity_log').insert({
        user_id: user.id,
        event_type: 'password_change',
        description: 'Cambio de contraseña realizado con éxito'
      })

      return { success: true }
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("Error changing password:", err)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const { data, error: sessionsError } = await supabase.rpc('get_my_active_sessions')
      
      if (sessionsError) throw sessionsError
      
      setSessions(data || [])
      return { success: true, data }
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("Error fetching sessions:", err)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const logoutOthers = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { error: logoutError } = await supabase.auth.signOut({ scope: 'others' })
      if (logoutError) throw logoutError
      
      // Loguear actividad
      if (user) {
        await supabase.from('user_activity_log').insert({
          user_id: user.id,
          event_type: 'sessions_logout',
          description: 'Cierre de sesión remoto en otros dispositivos'
        })
      }

      await fetchSessions() // Refresh list
      return { success: true }
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("Error logging out others:", err)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const fetchActivityLog = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: activityError } = await supabase
        .from('user_activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (activityError) throw activityError
      setActivities(data || [])
      return { success: true, data }
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("Error fetching activity log:", err)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return { 
    profile, 
    sessions, 
    activities,
    loading, 
    error, 
    updateProfile, 
    changePassword, 
    fetchSessions, 
    logoutOthers,
    fetchActivityLog
  }
}
