import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, UserSession, UserActivityLog } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'

interface UserState {
  profile: UserProfile | null
  sessions: UserSession[]
  activities: UserActivityLog[]
  loading: boolean
  error: string | null
  initialized: boolean
  
  // Actions
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  initialize: () => Promise<() => void>
  fetchProfile: () => Promise<void>
  fetchSessions: () => Promise<{ success: boolean; data?: UserSession[]; error?: string }>
  fetchActivityLog: () => Promise<{ success: boolean; data?: UserActivityLog[]; error?: string }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  logoutOthers: () => Promise<{ success: boolean; error?: string }>
}

export const useUserStore = create<UserState>((set, get) => {
  const supabase = createClient()
  let channel: RealtimeChannel | null = null

  return {
    profile: null,
    sessions: [],
    activities: [],
    loading: false,
    error: null,
    initialized: false,

    setProfile: (profile) => set({ profile }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    initialize: async () => {
      if (get().initialized) return () => {}

      set({ loading: true, initialized: true })
      
      try {
        await get().fetchProfile()
        
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Subscribe to changes
          channel = supabase
            .channel(`profile-${session.user.id}`)
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'user_profiles',
              filter: `id=eq.${session.user.id}`
            }, (payload: { new: Partial<UserProfile> }) => {
              set((state) => ({
                profile: state.profile ? { ...state.profile, ...payload.new } : null
              }))
            })
            .subscribe()
        }
      } catch (err) {
        set({ error: (err as Error).message || 'Error inicializando perfil' })
      } finally {
        set({ loading: false })
      }

      return () => {
        if (channel) {
          supabase.removeChannel(channel)
          channel = null
          set({ initialized: false })
        }
      }
    },

    fetchProfile: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const { data, error } = await supabase
          .from('user_profiles')
          .select('*, roles:role_id (name)')
          .eq('id', session.user.id)
          .single()

        if (error) throw error

        if (data) {
          set({ 
            profile: {
              ...data,
              role_name: data.roles?.name || 'Usuario'
            }
          })
        }
      } catch (err) {
        set({ error: (err as Error).message })
      }
    },

    fetchSessions: async () => {
      try {
        set({ loading: true })
        const { data, error } = await supabase.rpc('get_my_active_sessions')
        if (error) throw error
        set({ sessions: data || [] })
        return { success: true, data }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      } finally {
        set({ loading: false })
      }
    },

    fetchActivityLog: async () => {
      try {
        set({ loading: true })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'No user' }

        const { data, error } = await supabase
          .from('user_activity_log')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        set({ activities: data || [] })
        return { success: true, data }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      } finally {
        set({ loading: false })
      }
    },

    updateProfile: async (updates) => {
      try {
        set({ loading: true })
        const { profile } = get()
        if (!profile) throw new Error('Perfil no cargado')

        const { error } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', profile.id)

        if (error) throw error
        
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null
        }))
        
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      } finally {
        set({ loading: false })
      }
    },

    changePassword: async (currentPassword, newPassword) => {
      try {
        set({ loading: true })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) throw new Error("Usuario no autenticado")

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        })

        if (loginError) throw new Error("La contraseña actual es incorrecta")

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        })

        if (updateError) throw updateError

        await supabase.from('user_activity_log').insert({
          user_id: user.id,
          event_type: 'password_change',
          description: 'Cambio de contraseña realizado con éxito'
        })

        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      } finally {
        set({ loading: false })
      }
    },

    logoutOthers: async () => {
      try {
        set({ loading: true })
        const { data: { user } } = await supabase.auth.getUser()
        const { error: logoutError } = await supabase.auth.signOut({ scope: 'others' })
        if (logoutError) throw logoutError
        
        if (user) {
          await supabase.from('user_activity_log').insert({
            user_id: user.id,
            event_type: 'sessions_logout',
            description: 'Cierre de sesión remoto en otros dispositivos'
          })
        }

        await get().fetchSessions()
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      } finally {
        set({ loading: false })
      }
    }
  }
})

