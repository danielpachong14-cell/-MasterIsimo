"use client"

import { useState, useEffect } from "react"
import { Appointment } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { cn, formatDate, formatTime, capitalize } from "@/lib/utils"

interface AppointmentDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: Appointment | null
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

export function AppointmentDetailsModal({ isOpen, onClose, appointment, onSuccess }: AppointmentDetailsModalProps) {
  const [newNote, setNewNote] = useState("")
  const [noteHistory, setNoteHistory] = useState("")
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true)
  const [isEditingHistory, setIsEditingHistory] = useState(false)
  const [editingContent, setEditingContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalNote, setFinalNote] = useState("")
  const supabase = createClient()

  useEffect(() => {
    if (appointment) {
      setNoteHistory(appointment.notes || appointment.comments || "")
      setNewNote("")
    }
  }, [appointment])

  if (!isOpen || !appointment) return null

  const handleSaveNotes = async () => {
    if (!newNote.trim()) return

    setSaving(true)
    try {
      const timestamp = new Date().toLocaleString('es-CO', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      })
      const noteEntry = `[${timestamp}] ${newNote.trim()}`
      const updatedNotes = noteHistory ? `${noteHistory}\n${noteEntry}` : noteEntry
      
      const { error } = await supabase
        .from('appointments')
        .update({ notes: updatedNotes })
        .eq('id', appointment.id)

      if (error) throw error
      
      setNoteHistory(updatedNotes)
      setNewNote("") // Clears the textarea after appending
      onSuccess?.()
      // We explicitly don't close the modal so they can continue looking at the history.
    } catch (e: unknown) {
      const err = e as { message?: string, code?: string };
      if (err.message?.includes("column") || err.code === 'PGRST204') {
        alert("⚠️ Error: La base de datos requiere una actualización.\n\nPor favor ejecuta este comando en el Editor SQL de tu Supabase:\n\nALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes text;")
      } else {
        alert("Error al guardar: " + err.message)
      }
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
    setSaving(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ notes: editingContent })
        .eq('id', appointment.id)

      if (error) throw error
      
      setNoteHistory(editingContent)
      setIsEditingHistory(false)
      onSuccess?.()
    } catch (e: unknown) {
      const err = e as { message?: string, code?: string };
      if (err.message?.includes("column") || err.code === 'PGRST204') {
        alert("⚠️ Error: La base de datos requiere una actualización.\n\nPor favor ejecuta este comando en el Editor SQL de tu Supabase:\n\nALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes text;")
      } else {
        alert("Error al guardar: " + err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAdvanceStatus = async () => {
    if (!appointment) return
    const nextStatus = STATUS_SEQUENCE[appointment.status]
    if (!nextStatus) return

    // If it's the final step, intercept to ask for a note
    if (nextStatus === 'FINALIZADO') {
      setIsFinalizing(true)
      return
    }

    setSaving(true)
    try {
      const updates: Record<string, string> = { status: nextStatus }
      
      if (nextStatus === 'EN_PORTERIA' && !appointment.arrival_time) {
        updates.arrival_time = new Date().toISOString()
      } else if (nextStatus === 'EN_MUELLE' && !appointment.docking_time) {
        updates.docking_time = new Date().toISOString()
      } else if (nextStatus === 'DESCARGANDO' && !appointment.start_unloading_time) {
        updates.start_unloading_time = new Date().toISOString()
      }

      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointment.id)

      if (error) throw error
      onSuccess?.()
    } catch (e: any) {
      alert("Error al avanzar estado: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmFinalization = async () => {
    if (!appointment || !finalNote.trim()) return

    setSaving(true)
    try {
      // 1. Prepare the note log
      const timestamp = new Date().toLocaleString('es-CO', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const formattedNote = `[CIERRE OPERATIVO - ${timestamp}] ${finalNote}`;
      const updatedNotes = noteHistory 
        ? `${noteHistory}\n\n${formattedNote}`
        : formattedNote;

      // 2. Atomic update: status AND notes AND end_unloading_time
      const updates: Record<string, string> = {
        status: 'FINALIZADO',
        notes: updatedNotes
      }
      
      if (!appointment.end_unloading_time) {
        updates.end_unloading_time = new Date().toISOString()
      }

      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointment.id)

      if (error) throw error
      
      onSuccess?.()
      setIsFinalizing(false)
      setFinalNote("")
    } catch (e: any) {
      alert("Error al finalizar operación: " + e.message)
    } finally {
      setSaving(false)
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

  const patioDuration = calculateDuration(appointment.arrival_time, appointment.docking_time, appointment.status === 'EN_PORTERIA')
  const dockDuration = calculateDuration(appointment.docking_time, appointment.start_unloading_time, appointment.status === 'EN_MUELLE')
  const unloadingDuration = calculateDuration(appointment.start_unloading_time, appointment.end_unloading_time, appointment.status === 'DESCARGANDO')

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
                {appointment.appointment_number || appointment.id.split('-')[0]}
              </p>
              <h2 className="text-3xl font-black font-headline tracking-tighter leading-none">
                {capitalize(appointment.company_name)}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-white/20 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                {appointment.status}
              </span>
              <span className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border backdrop-blur-md",
                getPunctualityStyle(appointment.punctuality_status)
              )}>
                {appointment.punctuality_status?.replace('_', ' ') || 'SIN STATUS'}
              </span>
              {appointment.is_walk_in && (
                <span className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                  EXPRESS
                </span>
              )}

              {/* Minimalist Advance Button / Final Note Input */}
              {STATUS_SEQUENCE[appointment.status] && (
                !isFinalizing ? (
                  <button
                    onClick={handleAdvanceStatus}
                    disabled={saving}
                    className={cn(
                      "ml-4 px-6 py-2 rounded-full text-[11px] font-black tracking-[0.15em] uppercase flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 shadow-xl border-b-2 border-white/20 hover:brightness-110",
                      NEXT_ACTION_LABELS[STATUS_SEQUENCE[appointment.status]].color,
                      saving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {NEXT_ACTION_LABELS[STATUS_SEQUENCE[appointment.status]].icon}
                    </span>
                    {NEXT_ACTION_LABELS[STATUS_SEQUENCE[appointment.status]].label}
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
                <p className="font-bold text-base text-on-surface">{formatTime(appointment.scheduled_time)}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-success mb-1 text-[18px]">login</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none mb-1">Llegada</p>
                <p className="font-bold text-base text-on-surface text-success">
                  {appointment.arrival_time ? new Date(appointment.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm border-l-4 border-l-amber-500 flex flex-col">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter mb-1">Tiempo en Patio</p>
                <p className="font-black text-lg text-on-surface leading-none">{patioDuration}</p>
                <p className="text-[8px] text-on-surface-variant my-1.5 uppercase">Portería → Muelle</p>
                <div className="mt-auto pt-2 border-t border-surface-container flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Inicio:</span>
                    <span className="font-mono">{formatTimeOnly(appointment.arrival_time)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Fin:</span>
                    <span className="font-mono">{formatTimeOnly(appointment.docking_time)}</span>
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
                    <span className="font-mono">{formatTimeOnly(appointment.docking_time)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Fin:</span>
                    <span className="font-mono">{formatTimeOnly(appointment.start_unloading_time)}</span>
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
                    <span className="font-mono">{formatTimeOnly(appointment.start_unloading_time)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-on-surface-variant">
                    <span className="font-bold">Fin:</span>
                    <span className="font-mono">{formatTimeOnly(appointment.end_unloading_time)}</span>
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
                    <p className="font-bold text-sm text-on-surface capitalize">{capitalize(appointment.driver_name)}</p>
                    <p className="text-xs text-on-surface-variant">{appointment.driver_phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Vehículo</p>
                    <p className="font-bold text-sm text-on-surface uppercase">{appointment.license_plate}</p>
                    <p className="text-xs text-on-surface-variant">{capitalize(appointment.vehicle_type)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">Órdenes de Compra (POs)</p>
                    <div className="flex flex-wrap gap-2">
                      {appointment.appointment_purchase_orders && appointment.appointment_purchase_orders.length > 0 ? (
                        appointment.appointment_purchase_orders.map(po => (
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Muelle Asignado</p>
                        {appointment.dock_name ? (
                          <span className="inline-flex items-center gap-1.5 font-black text-tertiary bg-tertiary/10 border border-tertiary/20 px-3 py-1.5 rounded-lg text-sm">
                            <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                            {appointment.dock_name}
                          </span>
                        ) : (
                          <span className="text-xs italic text-on-surface-variant">Sin asignar</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Total Cajas</p>
                        <p className="font-black text-xl text-on-surface">
                          {appointment.appointment_purchase_orders?.reduce((sum, po) => sum + (po.box_count || 0), 0) || appointment.box_count || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operación & Trazabilidad Libre */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container h-full flex flex-col">
                <h3 className="text-xs font-black tracking-widest text-primary/60 uppercase mb-4">Notas & Trazabilidad</h3>
                
                {appointment.force_reason && (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-4 shrink-0">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-700">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <p className="text-[10px] font-black uppercase tracking-widest">Asignación Forzada</p>
                    </div>
                    <p className="text-xs font-medium text-amber-900">{appointment.force_reason}</p>
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
