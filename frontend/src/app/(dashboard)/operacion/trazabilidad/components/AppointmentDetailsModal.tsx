"use client"

import { useState, useEffect } from "react"
import { Appointment } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { cn, formatDate, formatTime } from "@/lib/utils"

interface AppointmentDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: Appointment | null
  onSuccess?: () => void
}

export function AppointmentDetailsModal({ isOpen, onClose, appointment, onSuccess }: AppointmentDetailsModalProps) {
  const [newNote, setNewNote] = useState("")
  const [noteHistory, setNoteHistory] = useState("")
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true)
  const [isEditingHistory, setIsEditingHistory] = useState(false)
  const [editingContent, setEditingContent] = useState("")
  const [saving, setSaving] = useState(false)
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
        .update({ notes: updatedNotes } as any)
        .eq('id', appointment.id)

      if (error) throw error
      
      setNoteHistory(updatedNotes)
      setNewNote("") // Clears the textarea after appending
      onSuccess?.()
      // We explicitly don't close the modal so they can continue looking at the history.
    } catch (err: any) {
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
        .update({ notes: editingContent } as any)
        .eq('id', appointment.id)

      if (error) throw error
      
      setNoteHistory(editingContent)
      setIsEditingHistory(false)
      onSuccess?.()
    } catch (err: any) {
      if (err.message?.includes("column") || err.code === 'PGRST204') {
        alert("⚠️ Error: La base de datos requiere una actualización.\n\nPor favor ejecuta este comando en el Editor SQL de tu Supabase:\n\nALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes text;")
      } else {
        alert("Error al guardar: " + err.message)
      }
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

  const waitTimeStr = appointment.arrival_time && appointment.start_unloading_time
    ? `${Math.round((new Date(appointment.start_unloading_time).getTime() - new Date(appointment.arrival_time).getTime()) / 60000)} min`
    : appointment.arrival_time
      ? `${Math.round((new Date().getTime() - new Date(appointment.arrival_time).getTime()) / 60000)} min (activo)`
      : '--'

  const unloadingTimeStr = appointment.start_unloading_time && appointment.end_unloading_time
    ? `${Math.round((new Date(appointment.end_unloading_time).getTime() - new Date(appointment.start_unloading_time).getTime()) / 60000)} min`
    : appointment.start_unloading_time
      ? `${Math.round((new Date().getTime() - new Date(appointment.start_unloading_time).getTime()) / 60000)} min (activo)`
      : '--'

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
                {appointment.company_name}
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
            <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-primary mb-2">schedule</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Agendado (Cita)</p>
                <p className="font-bold text-on-surface">{formatTime(appointment.scheduled_time)}</p>
                <p className="text-xs text-on-surface-variant">{formatDate(appointment.scheduled_date)}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-success mb-2">login</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Llegada Real</p>
                <p className="font-bold text-on-surface">
                  {appointment.arrival_time ? new Date(appointment.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-amber-500 mb-2">timer</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tiempo de Espera</p>
                <p className="font-bold text-on-surface">{waitTimeStr}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container shadow-sm">
                <span className="material-symbols-outlined text-blue-500 mb-2">local_shipping</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tiempo Descargue</p>
                <p className="font-bold text-on-surface">{unloadingTimeStr}</p>
              </div>
            </div>

            {/* Logística */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container h-full">
                <h3 className="text-xs font-black tracking-widest text-primary/60 uppercase mb-4">Información Logística</h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Chofer</p>
                    <p className="font-bold text-sm text-on-surface">{appointment.driver_name}</p>
                    <p className="text-xs text-on-surface-variant">{appointment.driver_phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Vehículo</p>
                    <p className="font-bold text-sm text-on-surface uppercase">{appointment.license_plate}</p>
                    <p className="text-xs text-on-surface-variant">{appointment.vehicle_type}</p>
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
