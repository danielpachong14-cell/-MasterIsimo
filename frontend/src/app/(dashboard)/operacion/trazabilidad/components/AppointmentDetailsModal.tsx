import { useState, useEffect } from "react"
import { Appointment, AppointmentStatus } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { cn, formatTime, capitalize } from "@/lib/utils"
import { fetchAppointmentById, buildStatusTransitionUpdates, fetchActiveDocks, DockSelectionRow } from "@/lib/services/appointments"
import { assignDockAction } from "@/app/actions/appointments"
import { scheduleEngineAction } from "@/app/actions/scheduling"
import { AvailableSlot } from "@/types"
import { useUIStore } from "@/store/uiStore"

interface AppointmentDetailsModalProps {
  onSuccess?: () => void
}

const STATUS_SEQUENCE: Record<string, string> = {
  'PENDIENTE': 'EN_PORTERIA',
  'EN_PORTERIA': 'EN_MUELLE',
  'EN_MUELLE': 'DESCARGANDO',
  'DESCARGANDO': 'FINALIZADO'
};

const NEXT_ACTION_LABELS: Record<string, { label: string, icon: string, color: string }> = {
  'EN_PORTERIA': { label: 'INGRESAR A PORTERÍA', icon: 'login', color: 'bg-white text-primary hover:bg-blue-50' },
  'EN_MUELLE': { label: 'INGRESAR A MUELLE', icon: 'warehouse', color: 'bg-amber-500 text-white border-amber-400' },
  'DESCARGANDO': { label: 'INICIAR DESCARGUE', icon: 'play_circle', color: 'bg-sky-500 text-white border-sky-400' },
  'FINALIZADO': { label: 'FINALIZAR OPERACIÓN', icon: 'check_circle', color: 'bg-emerald-500 text-white border-emerald-400' }
};

export function AppointmentDetailsModal({ onSuccess }: AppointmentDetailsModalProps) {
  // ─── Zustand Store ───────────────────────
  const { 
    selectedAppointment: appointment, 
    isAppointmentModalOpen: isOpen, 
    closeAppointmentDetails: onClose,
    isAdvancedSchedulingMode: isAdvancedMode,
    setAdvancedSchedulingMode: setIsAdvancedMode
  } = useUIStore()

  // ─── Estado Reactivo & Sincronización ───────────────────────
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(appointment)
  const [newNote, setNewNote] = useState("")
  const [noteHistory, setNoteHistory] = useState("")
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true)
  const [isEditingHistory, setIsEditingHistory] = useState(false)
  const [editingContent, setEditingContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalNote, setFinalNote] = useState("")
  const [availableDocks, setAvailableDocks] = useState<DockSelectionRow[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null)
  const [isAssigningDock, setIsAssigningDock] = useState(false)
  const [showForceReason, setShowForceReason] = useState(false)
  const [forceReason, setForceReason] = useState("")
  
  const [rescheduleDate, setRescheduleDate] = useState<string>("")
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (appointment) {
      setCurrentAppointment(appointment)
      setSelectedDockId(appointment.dock_id)
    }
  }, [appointment])

  useEffect(() => {
    async function loadDocks() {
      if (!isOpen || !currentAppointment?.environment_id) return
      try {
        const docks = await fetchActiveDocks(supabase, currentAppointment.environment_id)
        setAvailableDocks(docks)
      } catch (err) {
        console.error("Error loading docks:", err)
      }
    }
    loadDocks()
  }, [isOpen, currentAppointment?.environment_id, supabase])

  useEffect(() => {
    if (!isOpen || !appointment?.id) return

    // Usar un nonce/timestamp para asegurar que el canal sea único por cada montaje del componente
    // Evita el error "cannot add callbacks after subscribe" al no reusar canales cacheados que aún estén suscribiéndose
    const channelName = `appt-modal-${appointment.id}-${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelName)

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `id=eq.${appointment.id}`
        },
        async () => {
          const updated = await fetchAppointmentById(supabase, appointment.id!)
          if (updated) {
            setCurrentAppointment(updated)
            setNoteHistory(updated.notes || updated.comments || "")
            setSelectedDockId(updated.dock_id)
          }
        }
      )
      .subscribe((status: string, err?: Error) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Suscrito exitosamente a: ${channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Fallo en la suscripción de: ${channelName}`, err)
        } else if (status === 'TIMED_OUT') {
          console.warn(`[Realtime] Se agotó el tiempo de espera para: ${channelName}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, appointment?.id, supabase])

  useEffect(() => {
    if (currentAppointment) {
      setNoteHistory(currentAppointment.notes || currentAppointment.comments || "")
      setNewNote("")
      if (!rescheduleDate && currentAppointment.scheduled_date) {
        setRescheduleDate(currentAppointment.scheduled_date)
      }
    }
  }, [currentAppointment, rescheduleDate])

  useEffect(() => {
    if (!isAdvancedMode || !rescheduleDate || !currentAppointment) return

    async function loadSlots() {
      setIsLoadingSlots(true)
      try {
        const calculatedTotalBoxes = currentAppointment!.appointment_purchase_orders?.reduce(
          (sum, po) => sum + (po.box_count || 0),
          0
        ) || currentAppointment!.box_count || 0

        const result = await scheduleEngineAction({
          date: rescheduleDate,
          environmentId: currentAppointment!.environment_id ?? null,
          vehicleTypeId: currentAppointment!.vehicle_type_id ?? null,
          totalBoxes: calculatedTotalBoxes,
        })
        setAvailableSlots(result.slots)
      } catch (error) {
        console.error("Error loading slots:", error)
      } finally {
        setIsLoadingSlots(false)
      }
    }
    loadSlots()
  }, [isAdvancedMode, rescheduleDate, currentAppointment])

  if (!isOpen || !currentAppointment) return null

  // ─── Handlers ──────────────────────────────────────────────

  const handleSaveNotes = async () => {
    if (!newNote.trim() || !currentAppointment) return

    setSaving(true)
    const originalNotes = noteHistory
    try {
      const timestamp = new Date().toLocaleString('es-CO', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      })
      const noteEntry = `[${timestamp}] ${newNote.trim()}`
      const updatedNotes = noteHistory ? `${noteHistory}\n${noteEntry}` : noteEntry
      
      setNoteHistory(updatedNotes)
      setNewNote("")

      const { error } = await supabase
        .from('appointments')
        .update({ notes: updatedNotes })
        .eq('id', currentAppointment.id)

      if (error) throw error
      onSuccess?.()
    } catch (e: unknown) {
      setNoteHistory(originalNotes)
      const err = e as { message?: string, code?: string };
      alert("Error al guardar: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleEditHistory = () => {
    if (!isEditingHistory) {
      setEditingContent(noteHistory)
    }
    setIsEditingHistory(!isEditingHistory)
  }

  const handleSaveEditedHistory = async () => {
    if (!currentAppointment) return
    setSaving(true)
    const originalNotes = noteHistory
    try {
      setNoteHistory(editingContent)
      setIsEditingHistory(false)

      const { error } = await supabase
        .from('appointments')
        .update({ notes: editingContent })
        .eq('id', currentAppointment.id)

      if (error) throw error
      onSuccess?.()
    } catch (e: unknown) {
      setNoteHistory(originalNotes)
      const err = e as { message?: string, code?: string };
      alert("Error al guardar: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdvanceStatus = async () => {
    if (!currentAppointment) return
    const nextStatus = STATUS_SEQUENCE[currentAppointment.status] as AppointmentStatus
    if (!nextStatus) return

    if ((nextStatus === 'EN_MUELLE' || nextStatus === 'DESCARGANDO') && !currentAppointment.dock_id) {
      alert("⚠️ REGLA OPERATIVA: Debe asignar un muelle físico antes de ingresar a muelle o iniciar descarga.")
      return
    }

    if (nextStatus === 'FINALIZADO') {
      setIsFinalizing(true)
      return
    }

    setSaving(true)
    
    const updates = buildStatusTransitionUpdates(currentAppointment, nextStatus)
    const originalAppointment = { ...currentAppointment }
    
    setCurrentAppointment({
      ...currentAppointment,
      ...updates
    } as Appointment)

    try {
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', currentAppointment.id)

      if (error) throw error
      onSuccess?.()
    } catch (e: unknown) {
      const error = e as Error
      // Revertir si falla
      setCurrentAppointment(originalAppointment)
      alert("Error al avanzar estado: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmFinalization = async () => {
    if (!currentAppointment || !finalNote.trim()) return

    setSaving(true)

    try {
      const timestamp = new Date().toLocaleString('es-CO', { 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const formattedNote = `[CIERRE OPERATIVO - ${timestamp}] ${finalNote}`;
      const updatedNotes = noteHistory ? `${noteHistory}\n\n${formattedNote}` : formattedNote;

      // Usar lógica centralizada + notas
      const baseUpdates = buildStatusTransitionUpdates(currentAppointment, 'FINALIZADO' as AppointmentStatus)
      const updates = {
        ...baseUpdates,
        notes: updatedNotes
      }
      
      // UI Optimista
      setCurrentAppointment({
        ...currentAppointment,
        ...updates
      } as Appointment)

      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', currentAppointment.id)

      if (error) throw error
      
      onSuccess?.()
      setIsFinalizing(false)
      setFinalNote("")
    } finally {
      setSaving(false)
    }
  }

  const handleAssignDock = async (force: boolean = false) => {
    if (!currentAppointment || !selectedDockId) return

    setIsAssigningDock(true)
    try {
      const result = await assignDockAction({
        appointmentId: currentAppointment.id,
        dockId: selectedDockId,
        scheduledDate: isAdvancedMode ? rescheduleDate : undefined,
        scheduledTime: isAdvancedMode && selectedTime ? `${selectedTime}:00` : undefined,
        forceReason: force ? forceReason : undefined
      })

      if (result.success) {
        onSuccess?.()
        setShowForceReason(false)
        setForceReason("")
        // El re-fetch real-time se encargará de actualizar el estado local
      } else {
        if (result.isConflict && !force) {
          setShowForceReason(true)
        } else {
          alert(result.error)
        }
      }
    } catch (err) {
      console.error("Error in assignDockAction:", err)
      alert("Error de comunicación con el servidor.")
    } finally {
      setIsAssigningDock(false)
    }
  }

  const getPunctualityStyle = (status?: string | null) => {
    if (!status || status === 'N/A (Sin Cita)') return "bg-surface-container-high text-on-surface-variant"
    if (status === 'TARDE') return "bg-red-100 text-red-700 border-red-200"
    if (status === 'A_TIEMPO') return "bg-green-100 text-green-700 border-green-200"
    return "bg-blue-100 text-blue-700 border-blue-200"
  }

  const formatTimeOnly = (dateString?: string | null) => {
    if (!dateString) return '--:--'
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const calculateDuration = (start?: string | null, end?: string | null, isActive?: boolean) => {
    if (!start) return '--'
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : new Date().getTime()
    const diff = Math.round((endTime - startTime) / 60000)
    return `${diff} min${!end && isActive ? ' (activo)' : ''}`
  }

  const patioDuration = calculateDuration(currentAppointment.arrival_time, currentAppointment.docking_time, currentAppointment.status === 'EN_PORTERIA')
  const dockDuration = calculateDuration(currentAppointment.docking_time, currentAppointment.start_unloading_time, currentAppointment.status === 'EN_MUELLE')
  const unloadingDuration = calculateDuration(currentAppointment.start_unloading_time, currentAppointment.end_unloading_time, currentAppointment.status === 'DESCARGANDO')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header - Ethereal Style */}
        <div className="bg-kinetic-gradient p-6 sm:p-8 flex items-start justify-between relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-full bg-black/10 backdrop-blur-[2px]" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-6 text-white w-full">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80">
                {currentAppointment.appointment_number || currentAppointment.id.split('-')[0]}
              </p>
              <h2 className="text-3xl font-black font-headline tracking-tighter leading-none">
                {capitalize(currentAppointment.company_name)}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-white/20 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                {currentAppointment.status}
              </span>
              <span className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border backdrop-blur-md",
                getPunctualityStyle(currentAppointment.punctuality_status)
              )}>
                {currentAppointment.punctuality_status?.replace('_', ' ') || 'SIN STATUS'}
              </span>
              {currentAppointment.is_walk_in && (
                currentAppointment.is_express ? (
                  <span className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                    EXPRESS
                  </span>
                ) : (
                  <span className="bg-red-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                    LLEGADA SIN CITA
                  </span>
                )
              )}

              {/* Minimalist Advance Button / Final Note Input */}
              {STATUS_SEQUENCE[currentAppointment.status] && (
                !isFinalizing ? (
                  <button
                    onClick={handleAdvanceStatus}
                    disabled={saving}
                    className={cn(
                      "ml-4 px-6 py-2 rounded-full text-[11px] font-black tracking-[0.15em] uppercase flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 shadow-xl border-b-2 border-white/20 hover:brightness-110",
                      NEXT_ACTION_LABELS[STATUS_SEQUENCE[currentAppointment.status]].color,
                      saving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {NEXT_ACTION_LABELS[STATUS_SEQUENCE[currentAppointment.status]].icon}
                    </span>
                    {NEXT_ACTION_LABELS[STATUS_SEQUENCE[currentAppointment.status]].label}
                  </button>
                ) : (
                  <div className="ml-4 flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="relative group">
                      <input
                        type="text"
                        autoFocus
                        value={finalNote}
                        onChange={(e) => setFinalNote(e.target.value.slice(0, 280))}
                        placeholder="Nota final (estilo tweet)..."
                        className="bg-white/10 border border-white/20 text-white text-xs px-4 py-2 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-white/40 transition-all font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && finalNote.trim()) handleConfirmFinalization();
                          if (e.key === 'Escape') setIsFinalizing(false);
                        }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black tabular-nums transition-colors",
                          finalNote.length >= 260 ? "text-amber-400" : "text-white/40"
                        )}>
                          {280 - finalNote.length}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleConfirmFinalization}
                      disabled={saving || !finalNote.trim()}
                      className="bg-emerald-500 text-white p-2 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center group"
                      title="Confirmar Cierre"
                    >
                      <span className="material-symbols-outlined text-[20px]">done_all</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsFinalizing(false);
                        setFinalNote("");
                      }}
                      className="bg-white/10 text-white/60 p-2 rounded-xl hover:bg-white/20 transition-all"
                      title="Cancelar"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Bento Grid Content */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-surface-container-lowest">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tiempos Vitales */}
            <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-primary mb-1 text-[18px]">schedule</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none mb-1">Cita</p>
                <p className="font-bold text-base text-on-surface">{formatTime(currentAppointment.scheduled_time)}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-success mb-1 text-[18px]">login</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none mb-1">Llegada</p>
                <p className="font-bold text-base text-on-surface text-success">
                  {currentAppointment.arrival_time ? new Date(currentAppointment.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm border-l-4 border-l-amber-500 flex flex-col">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter mb-1">Tiempo en Patio</p>
                <p className="font-black text-lg text-on-surface leading-none">{patioDuration}</p>
                <p className="text-[8px] text-on-surface-variant my-1.5 uppercase">Portería → Muelle</p>
                <div className="mt-auto pt-2 border-t border-surface-container flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Inicio:</span>
                    <span className="font-mono">{formatTimeOnly(currentAppointment.arrival_time)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Fin:</span>
                    <span className="font-mono">{formatTimeOnly(currentAppointment.docking_time)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm border-l-4 border-l-blue-500 flex flex-col">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter mb-1">Tiempo en Muelle</p>
                <p className="font-black text-lg text-on-surface leading-none">{dockDuration}</p>
                <p className="text-[8px] text-on-surface-variant my-1.5 uppercase">Muelle → Descarga</p>
                <div className="mt-auto pt-2 border-t border-surface-container flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Inicio:</span>
                    <span className="font-mono">{formatTimeOnly(currentAppointment.docking_time)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Fin:</span>
                    <span className="font-mono">{formatTimeOnly(currentAppointment.start_unloading_time)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm border-l-4 border-l-indigo-600 flex flex-col">
                <p className="text-[9px] font-black text-indigo-700 uppercase tracking-tighter mb-1">Tiempo Descargue</p>
                <p className="font-black text-lg text-on-surface leading-none">{unloadingDuration}</p>
                <p className="text-[8px] text-on-surface-variant my-1.5 uppercase">Operación Activa</p>
                <div className="mt-auto pt-2 border-t border-surface-container flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Inicio:</span>
                    <span className="font-mono">{formatTimeOnly(currentAppointment.start_unloading_time)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Fin:</span>
                    <span className="font-mono">{formatTimeOnly(currentAppointment.end_unloading_time)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logística */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container h-full">
                <h3 className="text-xs font-black tracking-widest text-primary/60 uppercase mb-4">Información Logística</h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Chofer</p>
                    <p className="font-bold text-sm text-on-surface capitalize">{capitalize(currentAppointment.driver_name)}</p>
                    <p className="text-xs text-on-surface-variant">{currentAppointment.driver_phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Vehículo</p>
                    <p className="font-bold text-sm text-on-surface uppercase">{currentAppointment.license_plate?.toUpperCase()}</p>
                    <p className="text-xs text-on-surface-variant">{capitalize(currentAppointment.vehicle_type)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Órdenes de Compra (POs)</p>
                    <div className="flex flex-wrap gap-2">
                      {currentAppointment.appointment_purchase_orders && currentAppointment.appointment_purchase_orders.length > 0 ? (
                        currentAppointment.appointment_purchase_orders.map(po => (
                          <div key={po.id} className="bg-white border border-surface-container-high/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-primary">receipt_long</span>
                            <span className="text-xs font-bold">{po.po_number || 'S/N'}</span>
                            <span className="text-[10px] font-bold bg-surface-container px-1.5 rounded text-on-surface-variant">{po.box_count} cjs</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-on-surface-variant border border-dashed border-surface-container p-2 rounded w-full text-center">No hay POs registrados</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 pt-4 border-t border-surface-container/50">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Muelle {isAdvancedMode ? 'y Horario' : 'Asignado'}</p>
                          <div className="flex items-center gap-2">
                            {!isAdvancedMode ? (
                              <select
                                title="Seleccionar muelle"
                                value={selectedDockId || ""}
                                disabled={isAssigningDock || currentAppointment.status === 'FINALIZADO'}
                                onChange={(e) => setSelectedDockId(e.target.value ? parseInt(e.target.value) : null)}
                                className={cn(
                                  "text-sm font-bold h-10 px-3 rounded-xl border border-surface-container bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all",
                                  !selectedDockId && "text-on-surface-variant italic font-normal"
                                )}
                              >
                                <option value="">Sin asignar</option>
                                {/* Inyectar muelle actual si no está en la lista (evita glitch de "Sin asignar") */}
                                {currentAppointment.dock_id && !availableDocks.some(d => d.id === currentAppointment.dock_id) && (
                                  <option value={currentAppointment.dock_id}>
                                    {currentAppointment.dock_name || `Muelle ${currentAppointment.dock_id}`} (Actual)
                                  </option>
                                )}
                                {availableDocks.map(dock => (
                                  <option key={dock.id} value={dock.id}>{dock.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-xl">event_upcoming</span>
                                <input
                                  type="date"
                                  value={rescheduleDate}
                                  onChange={(e) => setRescheduleDate(e.target.value)}
                                  className="text-sm font-bold h-10 px-3 rounded-xl border border-surface-container bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                              </div>
                            )}

                            {(selectedDockId !== currentAppointment.dock_id || (isAdvancedMode && selectedTime)) && (
                              <button
                                onClick={() => handleAssignDock(false)}
                                disabled={isAssigningDock}
                                className="bg-primary text-white p-2 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center gap-1 pr-3"
                                title="Guardar Cambios"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {isAssigningDock ? 'autorenew' : 'save'}
                                </span>
                                <span className="text-[10px] font-black uppercase">Confirmar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                          disabled={currentAppointment.status === 'FINALIZADO'}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all",
                            isAdvancedMode 
                              ? "bg-primary text-white shadow-md ring-2 ring-primary/20" 
                              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                          )}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isAdvancedMode ? 'bolt' : 'event_note'}
                          </span>
                          {isAdvancedMode ? 'Modo Avanzado ON' : 'Agendamiento Avanzado'}
                        </button>
                      </div>

                      {/* Cuadrícula de Slots (Solo en modo avanzado) */}
                      {isAdvancedMode && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          {isLoadingSlots ? (
                            <div className="grid grid-cols-3 gap-2">
                              {[1,2,3].map(i => (
                                <div key={i} className="h-10 bg-surface-container animate-pulse rounded-lg" />
                              ))}
                            </div>
                          ) : availableSlots.length === 0 ? (
                            <div className="py-4 text-center bg-surface-container-low rounded-xl border border-dashed border-surface-container">
                              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Sin disponibilidad para esta fecha</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                              {availableSlots.map((slot, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTime(slot.time)
                                    setSelectedDockId(slot.dock_id)
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg border transition-all text-center group relative",
                                    selectedTime === slot.time && selectedDockId === slot.dock_id
                                      ? "bg-primary text-white border-primary shadow-sm"
                                      : slot.time === currentAppointment.scheduled_time?.substring(0, 5) && slot.dock_id === currentAppointment.dock_id && rescheduleDate === currentAppointment.scheduled_date
                                        ? "bg-primary-fixed/10 border-primary/30"
                                        : "bg-white border-surface-container hover:border-primary/40 hover:bg-primary/5"
                                  )}
                                >
                                  {slot.time === currentAppointment.scheduled_time?.substring(0, 5) && slot.dock_id === currentAppointment.dock_id && rescheduleDate === currentAppointment.scheduled_date && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                                  )}
                                  <p className="text-sm font-black leading-none">{slot.time}</p>
                                  <p className={cn(
                                    "text-[8px] font-bold uppercase truncate mt-0.5",
                                    selectedTime === slot.time && selectedDockId === slot.dock_id
                                      ? "text-white/70"
                                      : "text-on-surface-variant/50"
                                  )}>
                                    {slot.dock_name}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                        {showForceReason && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-in slide-in-from-top-2 duration-200">
                            <p className="text-[10px] font-black text-amber-700 uppercase mb-2">Conflicto Detectado - ¿Forzar Asignación?</p>
                            <textarea
                              placeholder="Razón de la excepción operativa..."
                              value={forceReason}
                              onChange={(e) => setForceReason(e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border-amber-200 focus:ring-amber-500 min-h-[60px] mb-2"
                            />
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                className="bg-amber-600 hover:bg-amber-700 text-[10px] flex-1"
                                onClick={() => handleAssignDock(true)}
                                disabled={!forceReason.trim() || isAssigningDock}
                              >
                                CONFIRMAR EXCEPCIÓN
                              </Button>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="text-[10px]"
                                onClick={() => {
                                  setShowForceReason(false)
                                  setSelectedDockId(currentAppointment.dock_id)
                                }}
                              >
                                CANCELAR
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Total Cajas</p>
                        <p className="font-black text-xl text-on-surface">
                          {currentAppointment.appointment_purchase_orders?.reduce((sum, po) => sum + (po.box_count || 0), 0) || currentAppointment.box_count || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operación & Trazabilidad Libre */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container h-full flex flex-col">
                <h3 className="text-xs font-black tracking-widest text-primary/60 uppercase mb-4">Notas & Trazabilidad</h3>
                
                {currentAppointment.force_reason && (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-4 shrink-0">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-700">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <p className="text-[10px] font-black uppercase tracking-widest">Asignación Forzada</p>
                    </div>
                    <p className="text-xs font-medium text-amber-900">{currentAppointment.force_reason}</p>
                  </div>
                )}

                <div className="flex flex-col flex-1">
                  {noteHistory && (
                    <div className="bg-surface-container-highest/20 border border-surface-container rounded-xl p-3 mb-4 shrink-0 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <button 
                          className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1 hover:text-primary transition-colors"
                          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        >
                          Historial de Novedades
                          <span className="material-symbols-outlined text-[14px]">
                            {isHistoryExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                        {isHistoryExpanded && (
                          <button 
                            onClick={toggleEditHistory} 
                            className={cn(
                              "text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center w-6 h-6 rounded-md",
                              isEditingHistory && "bg-surface-container text-primary"
                            )}
                            title={isEditingHistory ? "Cancelar Edición" : "Editar Historial Completo"}
                          >
                            <span className="material-symbols-outlined text-[14px]">{isEditingHistory ? 'close' : 'edit_square'}</span>
                          </button>
                        )}
                      </div>

                      {isHistoryExpanded && (
                        isEditingHistory ? (
                          <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full rounded-lg border border-primary/40 bg-white p-2 text-xs min-h-[100px] resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                            <div className="flex justify-end">
                              <Button 
                                variant="secondary" 
                                className="h-7 text-[10px] px-3 gap-1 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border-none" 
                                onClick={handleSaveEditedHistory} 
                                isLoading={saving}
                              >
                                GUARDAR HISTORIAL
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-1 animate-in fade-in duration-200">
                            {noteHistory.split('\n').map((line, idx) => {
                              // Resaltar opcionalmente el timestamp para fácil lectura
                              const match = line.match(/^\[(.*?)\] (.*)$/)
                              if (match) {
                                return (
                                  <p key={idx} className="text-xs text-on-surface leading-snug">
                                    <span className="font-mono text-[10px] text-primary/70 bg-primary/5 px-1 rounded mr-1.5 align-middle">[{match[1]}]</span>
                                    {match[2]}
                                  </p>
                                )
                              }
                              return <p key={idx} className="text-xs text-on-surface whitespace-pre-wrap">{line}</p>
                            })}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <label htmlFor="notes" className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Agregar Nueva Novedad</label>
                  <textarea 
                    id="notes"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Registra demoras, problemas de carga, o cambios de muelle..."
                    className="w-full rounded-xl border border-surface-container bg-white p-3 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none h-[100px]"
                  />
                </div>
                
                <div className="pt-4 shrink-0 mt-auto">
                  <Button 
                    className="w-full text-xs font-black tracking-widest gap-2" 
                    onClick={handleSaveNotes}
                    isLoading={saving}
                  >
                    GUARDAR NOTAS
                    <span className="material-symbols-outlined text-[16px]">save</span>
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
