"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Appointment } from "@/types"

export function DeleteAppointmentModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment 
}: {
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  appointment: Appointment | null;
}) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  if (!isOpen || !appointment) return null

  const handleDelete = async () => {
    setLoading(true)

    try {
      // Perform deletion
      // Constraints have CASCADE, so audit logs and POs will be removed automatically
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment.id)

      if (deleteError) {
        throw new Error(`No se pudo eliminar la cita: ${deleteError.message}`)
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error("Error deleting appointment:", error)
      alert(`Ocurrió un error al eliminar la cita: ${error.message || "Error desconocido"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <div>
              <h3 className="text-xl font-black font-headline text-red-600">¿Eliminar Cita?</h3>
              <p className="text-sm text-on-surface-variant font-medium">Esta acción eliminará todos los registros asociados de forma permanente.</p>
            </div>
          </div>

          <div className="bg-red-50/50 p-4 rounded-xl space-y-2 border border-red-100">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-red-900">{appointment.company_name}</p>
              <span className="text-[10px] font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                {appointment.id.split('-')[0]}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xs text-red-700/70 flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-[14px]">local_shipping</span> 
                {appointment.license_plate}
              </p>
              <p className="text-xs text-red-700/70 flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-[14px]">calendar_today</span> 
                {new Date(appointment.scheduled_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl flex gap-3 border border-amber-100">
            <span className="material-symbols-outlined text-amber-600">warning</span>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              Al eliminar la cita se borrarán también las **Órdenes de Compra** vinculadas y el historial de **Auditoría**. No se podrá recuperar esta información.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white shadow-lg shadow-red-600/20" onClick={handleDelete} disabled={loading}>
              {loading ? 'Eliminando...' : 'Sí, Eliminar Todo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
