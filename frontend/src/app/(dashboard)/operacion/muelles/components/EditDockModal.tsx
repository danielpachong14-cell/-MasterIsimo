"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import type { Appointment, Dock } from "@/types"
import type { TimelineAppointmentRow } from "@/lib/services/appointments"

interface EditDockModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: Appointment | TimelineAppointmentRow | null
  docks: Dock[]
  onSave: (id: string, dockId: number, time: string, endTime: string) => void
  loading: boolean
}

/**
 * Modal de edición de muelle y horario para una cita existente.
 * Permite cambiar el muelle asignado, hora de inicio y hora de finalización.
 */
export function EditDockModal({
  isOpen,
  onClose,
  appointment,
  docks,
  onSave,
  loading,
}: EditDockModalProps) {
  const [editDockId, setEditDockId] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")

  // Sincronizar campos al abrir el modal con la cita seleccionada
  useEffect(() => {
    if (appointment) {
      setEditDockId(appointment.dock_id?.toString() || "")
      setEditTime(appointment.scheduled_time?.substring(0, 5) || "")
      setEditEndTime(appointment.scheduled_end_time?.substring(0, 5) || "")
    }
  }, [appointment])

  if (!isOpen || !appointment) return null

  const totalBoxes =
    appointment.appointment_purchase_orders?.reduce(
      (s, po) => s + (po.box_count || 0),
      0
    ) || appointment.box_count || 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-float w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-surface-container">
          <h3 className="text-xl font-black font-headline">Editar Cita</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Info header */}
          <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-4">
            <div className="bg-primary px-3 py-1.5 rounded-lg">
              <span className="text-white font-black text-sm tracking-tight">
                {appointment.license_plate}
              </span>
            </div>
            <div>
              <p className="font-bold text-sm">{appointment.company_name}</p>
              <p className="text-[10px] text-on-surface-variant/60">
                {totalBoxes} cajas · {appointment.estimated_duration_minutes} min estimados
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">
                Muelle Asignado
              </label>
              <select
                className="flex w-full rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 h-[56px] appearance-none"
                value={editDockId}
                onChange={(e) => setEditDockId(e.target.value)}
              >
                <option value="">-- Sin Asignar --</option>
                {docks
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">
                Hora de Inicio
              </label>
              <Input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">
              Hora de Fin (Extender si es necesario)
            </label>
            <Input
              type="time"
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
            />
            <p className="text-[10px] text-on-surface-variant/50 mt-1">
              Modifica este campo si la descarga toma más del tiempo estimado.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() =>
              onSave(appointment.id, parseInt(editDockId), editTime + ":00", editEndTime + ":00")
            }
            disabled={loading || !editDockId || !editTime}
          >
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>
    </div>
  )
}
