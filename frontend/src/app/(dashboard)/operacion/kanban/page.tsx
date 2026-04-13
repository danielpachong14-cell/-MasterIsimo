"use client"

import { useState, useEffect, useCallback } from "react"
import { KanbanBoard } from "@/components/features/KanbanBoard"
import { Card } from "@/components/ui/Card"
import { createClient } from "@/lib/supabase/client"
import { Appointment, Dock, AppointmentStatus } from "@/types"

export default function KanbanPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const supabase = createClient()

  // Centralized data fetching handling all uncompleted operations
  const fetchData = useCallback(async () => {
    // 1. Fetch appointments that are currently active (not finalized or cancelled)
    const { data: apptData } = await supabase
      .from('appointments')
      .select('*, appointment_purchase_orders(*)')
      .in('status', ['PENDIENTE', 'EN_PORTERIA', 'EN_MUELLE', 'DESCARGANDO'])
      .order('created_at', { ascending: true })

    if (apptData) setAppointments(apptData as Appointment[])

    // 2. Fetch total active docks to calculate availability
    const { data: docksData } = await supabase
      .from('docks')
      .select('*')
      .eq('is_active', true)
      
    if (docksData) setDocks(docksData as Dock[])
  }, [supabase])

  // Subscriptions for real-time operation
  useEffect(() => {
    fetchData()

    const channelAppointments = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchData()
      })
      .subscribe()
      
    const channelDocks = supabase
      .channel('docks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docks' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { 
      supabase.removeChannel(channelAppointments)
      supabase.removeChannel(channelDocks)
    }
  }, [supabase, fetchData])

  // --- KPI COMPUTATIONS ---
  // 1. En Espera: Appointments that haven't reached the dock yet
  const enEspera = appointments.filter(a => ['PENDIENTE', 'EN_PORTERIA'].includes(a.status)).length

  // 2. Muelles Libres: Total active docks minus appointments currently occupying a dock
  const enMuelleOcupados = appointments.filter(a => ['EN_MUELLE', 'DESCARGANDO'].includes(a.status)).length
  const totalActivos = docks.length || 12 // fallback visually if no docks
  const muellesLibres = Math.max(0, totalActivos - enMuelleOcupados)
  
  // 3. Eficiencia: Percentage of appointments that are not late
  const totalEvaluados = appointments.filter(a => a.punctuality_status).length
  const aTiempo = appointments.filter(a => a.punctuality_status && a.punctuality_status !== 'TARDE').length
  const eficiencia = totalEvaluados > 0 
    ? Math.round((aTiempo / totalEvaluados) * 100) 
    : 100 // Default optimal base

  // Unified Status Updater for the Board
  const updateAppointmentStatus = async (id: string, newStatus: AppointmentStatus) => {
    // Optimistic Update
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    
    // Server Update
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) fetchData() // Revert state from server if it failed
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Dashboard Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">Vista Operativa</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">PANEL DE PATIO</h1>
        </div>
        
        {/* Real-time Bento Stats Row */}
        <div className="flex flex-wrap gap-4">
          <Card className="px-6 py-4 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">local_shipping</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">En Espera</p>
              <p className="text-2xl font-black font-headline leading-none">{enEspera}</p>
            </div>
          </Card>
          <Card className="px-6 py-4 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary">stadium</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Muelles Libres</p>
              <p className="text-2xl font-black font-headline leading-none">{muellesLibres}/{totalActivos}</p>
            </div>
          </Card>
          <Card className={`px-6 py-4 flex items-center gap-4 ${eficiencia < 80 ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-white'} border-none shadow-elevated transition-colors`}>
            <div className={`w-12 h-12 rounded-xl ${eficiencia < 80 ? 'bg-error text-on-error' : 'bg-primary text-white'} flex items-center justify-center`}>
              <span className="material-symbols-outlined">{eficiencia < 80 ? 'warning' : 'speed'}</span>
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Eficiencia</p>
              <p className="text-2xl font-black font-headline leading-none">{eficiencia}%</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Kanban Board Area */}
      <KanbanBoard appointments={appointments} onStatusChange={updateAppointmentStatus} />
    </div>
  )
}
