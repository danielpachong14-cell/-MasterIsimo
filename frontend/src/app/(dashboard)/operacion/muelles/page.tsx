"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Appointment, Dock, CediSettings } from "@/types"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { DockTimeline } from "@/components/features/DockTimeline"
import { parseTime, formatTimeFromMinutes } from "@/lib/services/scheduling"

// ─── Confirmation Modal ─────────────────────────────────────
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, loading }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; loading: boolean
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="p-8 space-y-4">
          <div className="w-14 h-14 bg-tertiary-fixed/30 rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl text-tertiary">swap_horiz</span>
          </div>
          <h3 className="text-xl font-black font-headline text-center">{title}</h3>
          <p className="text-sm text-on-surface-variant text-center leading-relaxed">{message}</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button className="flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? 'Procesando...' : 'Confirmar Cambio'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Appointment Modal ─────────────────────────────────
function EditModal({ isOpen, onClose, appointment, docks, onSave, loading }: {
  isOpen: boolean; onClose: () => void; appointment: Appointment | null; docks: Dock[]; onSave: (id: string, dockId: number, time: string, endTime: string) => void; loading: boolean
}) {
  const [editDockId, setEditDockId] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  useEffect(() => {
    if (appointment) {
      setEditDockId(appointment.dock_id?.toString() || '')
      setEditTime(appointment.scheduled_time?.substring(0, 5) || '')
      setEditEndTime(appointment.scheduled_end_time?.substring(0, 5) || '')
    }
  }, [appointment])

  if (!isOpen || !appointment) return null

  const totalBoxes = appointment.appointment_purchase_orders?.reduce((s, po) => s + (po.box_count || 0), 0) || appointment.box_count || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 py-6 border-b border-surface-container">
          <h3 className="text-xl font-black font-headline">Editar Cita</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="p-8 space-y-6">
          {/* Info header */}
          <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-4">
            <div className="bg-primary px-3 py-1.5 rounded-lg">
              <span className="text-white font-black text-sm tracking-tight">{appointment.license_plate}</span>
            </div>
            <div>
              <p className="font-bold text-sm">{appointment.company_name}</p>
              <p className="text-[10px] text-on-surface-variant/60">{totalBoxes} cajas · {appointment.estimated_duration_minutes} min estimados</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">Muelle Asignado</label>
              <select
                className="flex w-full rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 h-[56px] appearance-none"
                value={editDockId}
                onChange={e => setEditDockId(e.target.value)}
              >
                <option value="">-- Sin Asignar --</option>
                {docks.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">Hora de Inicio</label>
              <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">Hora de Fin (Extendr si es necesario)</label>
            <Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
            <p className="text-[10px] text-on-surface-variant/50 mt-1">Modifica este campo si la descarga toma más del tiempo estimado.</p>
          </div>

          <Button className="w-full" onClick={() => onSave(appointment.id, parseInt(editDockId), editTime + ':00', editEndTime + ':00')} disabled={loading || !editDockId || !editTime}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────
export default function MuellesPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [settings, setSettings] = useState<CediSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{ appointmentId: string; newDockId: number; newTime: string } | null>(null)
  const [editModal, setEditModal] = useState<Appointment | null>(null)
  const [extendModal, setExtendModal] = useState<string | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const supabase = createClient()

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    // 1. Obtener settings
    // 2. Obtener muelles ACTIVOS y que permitan DESCARGA (o mixtos autorizados)
    // 3. Obtener citas
    const [sRes, dRes, aRes] = await Promise.all([
      supabase.from('cedi_settings').select('*').single(),
      supabase.from('docks')
        .select('*')
        .eq('is_active', true)
        .or(`type.eq.DESCARGUE,and(type.eq.MIXTO,is_unloading_authorized.eq.true)`)
        .order('priority')
        .order('id'),
      supabase.from('appointments').select(`*, appointment_purchase_orders(*)`).eq('scheduled_date', date).neq('status', 'CANCELADO').order('scheduled_time')
    ])

    if (sRes.data) setSettings(sRes.data)
    if (dRes.data) setDocks(dRes.data)
    if (aRes.data) setAppointments(aRes.data)
    setLoading(false)
  }, [supabase, date])

  useEffect(() => { 
    setLoading(true)
    fetchData() 
  }, [fetchData])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('muelles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchData])

  // ─── Handlers ─────────────────────────────────────────────
  const handleAppointmentMove = useCallback((appointmentId: string, newDockId: number, newTime: string) => {
    setConfirmModal({ appointmentId, newDockId, newTime })
  }, [])

  const handleConfirmMove = async () => {
    if (!confirmModal) return
    setActionLoading(true)
    
    // ─── VALIDACIÓN DE COLISIÓN (Mejorada para manejar NULLs y estados) ───
    const appt = appointments.find(a => a.id === confirmModal.appointmentId)
    const duration = appt?.estimated_duration_minutes || 60
    const proposedStartMin = parseTime(confirmModal.newTime)
    const proposedEndMin = proposedStartMin + duration
    
    const hasCollision = appointments.some(a => 
      a.id !== confirmModal.appointmentId && 
      a.dock_id === confirmModal.newDockId &&
      a.status !== 'CANCELADO' &&
      // Choca si la cita existente termina después de que la nuestra empiece Y empieza antes de que la nuestra termine
      parseTime(a.scheduled_time) < proposedEndMin &&
      (parseTime(a.scheduled_end_time || '') || parseTime(a.scheduled_time) + (a.estimated_duration_minutes || 60)) > proposedStartMin
    )

    if (hasCollision) {
      showToast('Conflicto: El espacio en el muelle no está disponible.', 'error')
      setActionLoading(false)
      setConfirmModal(null)
      return
    }

    const newEndTime = formatTimeFromMinutes(proposedEndMin)
    
    const { error } = await supabase
      .from('appointments')
      .update({ 
        dock_id: confirmModal.newDockId, 
        scheduled_time: confirmModal.newTime,
        scheduled_end_time: newEndTime + ':00'
      })
      .eq('id', confirmModal.appointmentId)

    setActionLoading(false)
    setConfirmModal(null)
    
    if (error) {
      showToast('Error al reubicar la cita.', 'error')
    } else {
      showToast('Cita reubicada exitosamente.', 'success')
      fetchData()
    }
  }

  const handleAppointmentEdit = useCallback((appointment: Appointment) => {
    setEditModal(appointment)
  }, [])

  const handleSaveEdit = async (id: string, dockId: number, time: string, endTime: string) => {
    setActionLoading(true)

    const newStartMin = parseTime(time)
    const newEndMin = parseTime(endTime)
    const newDuration = newEndMin - newStartMin

    // ─── VALIDACIÓN DE COLISIÓN ───
    const hasCollision = appointments.some(a => 
      a.id !== id &&
      a.dock_id === dockId &&
      a.status !== 'CANCELADO' && a.status !== 'FINALIZADO' &&
      parseTime(a.scheduled_time) < newEndMin &&
      (a.scheduled_end_time ? parseTime(a.scheduled_end_time) : parseTime(a.scheduled_time) + (a.estimated_duration_minutes || 60)) > newStartMin
    )

    if (hasCollision) {
      showToast('Conflicto: El cambio choca con otra cita programada en este muelle.', 'error')
      setActionLoading(false)
      return
    }

    const { error } = await supabase
      .from('appointments')
      .update({ 
        dock_id: dockId, 
        scheduled_time: time, 
        scheduled_end_time: endTime,
        estimated_duration_minutes: newDuration > 0 ? newDuration : undefined
      })
      .eq('id', id)

    setActionLoading(false)
    setEditModal(null)

    if (error) {
      showToast('Error al actualizar la cita.', 'error')
    } else {
      showToast('Cita actualizada.', 'success')
      fetchData()
    }
  }

  const handleConfirmExtendAction = useCallback(async (id: string, endTime: string) => {
    setActionLoading(true)
    
    const { error } = await supabase.rpc('shift_appointments_on_resize', {
      p_appointment_id: id,
      p_new_end_time: endTime
    })

    setActionLoading(false)
    setExtendModal(null)

    if (error) {
      showToast('Error al extender cita. Posible conflicto de muelles.', 'error')
    } else {
      showToast('Agenda ajustada correctamente.', 'success')
      fetchData()
    }
  }, [supabase, fetchData])

  const handleAppointmentExtend = useCallback((appointmentId: string, newEndTime?: string) => {
    if (newEndTime) {
      // Direct update via cascading shift
      handleConfirmExtendAction(appointmentId, newEndTime)
    } else {
      setExtendModal(appointmentId)
    }
  }, [handleConfirmExtendAction])

  const handleConfirmExtend = async () => {
    if (!extendModal) return
    const appt = appointments.find(a => a.id === extendModal)
    if (!appt) return

    // Default +30 min extend from button
    const currentEndMin = parseTime(appt.scheduled_end_time || '') || (parseTime(appt.scheduled_time) + (appt.estimated_duration_minutes || 60))
    const newEndMin = currentEndMin + 30
    const h = Math.floor(newEndMin / 60)
    const m = newEndMin % 60
    const newEndTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`

    handleConfirmExtendAction(extendModal, newEndTimeStr)
  }

  // Stats
  const activeDocks = docks.length
  const occupiedDocks = new Set(appointments.filter(a => ['EN_MUELLE', 'DESCARGANDO'].includes(a.status)).map(a => a.dock_id)).size
  const totalAppointments = appointments.length

  // Find the dock for the confirm modal
  const confirmDock = confirmModal ? docks.find(d => d.id === confirmModal.newDockId) : null
  const confirmAppt = confirmModal ? appointments.find(a => a.id === confirmModal.appointmentId) : null

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-xl shadow-float font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'}`}>
          <span className="material-symbols-outlined text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">Visualización de Recursos</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">MUELLES</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex gap-3">
            <Card className="px-4 py-2.5 flex items-center gap-3 bg-white/50 border-none shadow-ambient">
              <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-tertiary">warehouse</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Muelles</p>
                <p className="text-lg font-black font-headline leading-none">{occupiedDocks}/{activeDocks}</p>
              </div>
            </Card>
            <Card className="px-4 py-2.5 flex items-center gap-3 bg-white/50 border-none shadow-ambient">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-primary">local_shipping</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Citas</p>
                <p className="text-lg font-black font-headline leading-none">{totalAppointments}</p>
              </div>
            </Card>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]) }}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="w-[180px] text-center font-bold"
            />
            <button 
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]) }}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {loading || !settings ? (
        <div className="h-[400px] animate-pulse bg-surface-container rounded-2xl flex items-center justify-center">
          <p className="text-sm font-bold text-on-surface-variant/40">Cargando línea de tiempo...</p>
        </div>
      ) : docks.length === 0 ? (
        <Card variant="elevated" className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-primary/20 mb-4">warehouse</span>
          <h3 className="text-xl font-black font-headline text-on-surface/60">Sin Muelles Configurados</h3>
          <p className="text-sm text-on-surface-variant/50 mt-2 max-w-sm mx-auto">Dirígete a Configuración CEDI para crear muelles antes de visualizar la línea de tiempo.</p>
        </Card>
      ) : (
        <DockTimeline
          date={date}
          appointments={appointments}
          docks={docks}
          settings={settings}
          onAppointmentMove={handleAppointmentMove}
          onAppointmentExtend={handleAppointmentExtend}
          onAppointmentEdit={handleAppointmentEdit}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {[
          { label: 'Pendiente', cls: 'bg-surface-container-highest' },
          { label: 'En Patio', cls: 'bg-secondary-fixed' },
          { label: 'En Muelle', cls: 'bg-tertiary-fixed/60' },
          { label: 'Descargando', cls: 'bg-tertiary-fixed' },
          { label: 'Finalizado', cls: 'bg-primary-fixed' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${s.cls}`} />
            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tip */}
      <p className="text-center text-[10px] text-on-surface-variant/30 font-bold uppercase tracking-widest">
        Arrastra para reubicar · Doble clic para editar · Hover en el botón de reloj para extender tiempo
      </p>

      {/* ═══ Confirm Move Modal ═══ */}
      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleConfirmMove}
        loading={actionLoading}
        title="Confirmar Reubicación"
        message={`¿Deseas mover la cita de ${confirmAppt?.license_plate || ''} (${confirmAppt?.company_name || ''}) al ${confirmDock?.name || 'muelle seleccionado'} a las ${confirmModal?.newTime?.substring(0, 5) || ''}?`}
      />

      {/* ═══ Edit Modal ═══ */}
      <EditModal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        appointment={editModal}
        docks={docks}
        onSave={handleSaveEdit}
        loading={actionLoading}
      />

      {/* ═══ Extend Time Modal ═══ */}
      <ConfirmModal
        isOpen={!!extendModal}
        onClose={() => setExtendModal(null)}
        onConfirm={handleConfirmExtend}
        loading={actionLoading}
        title="Extender Tiempo de Descarga"
        message={`¿Deseas extender 30 minutos adicionales al tiempo de descarga de ${appointments.find(a => a.id === extendModal)?.license_plate || 'esta cita'}? Esto actualizará la hora de fin en la línea de tiempo.`}
      />
    </div>
  )
}
