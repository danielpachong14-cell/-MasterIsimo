"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/Card"
import { Appointment } from "@/types"
import { cn, formatTime } from "@/lib/utils"

interface KanbanCardProps {
  appointment: Appointment
}

export function KanbanCard({ appointment }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: appointment.id,
    data: {
      type: "Appointment",
      appointment,
    },
  })

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 h-[140px] rounded-xl bg-surface-container-highest border-2 border-dashed border-primary/20"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group"
    >
      <Card
        variant="elevated"
        className="p-5 space-y-4 hover:translate-y-[-2px] hover:shadow-float active:scale-[0.98] cursor-grab active:cursor-grabbing relative overflow-hidden"
      >
        {/* Status Vertical Bar */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5",
          appointment.status === 'PENDIENTE' && "bg-surface-container-highest",
          appointment.status === 'EN_PORTERIA' && "bg-secondary-fixed-dim",
          appointment.status === 'EN_MUELLE' && "bg-tertiary-fixed",
          appointment.status === 'DESCARGANDO' && "bg-tertiary",
          appointment.status === 'FINALIZADO' && "bg-primary",
        )} />

        <div className="flex justify-between items-start pl-2">
          <div className="space-y-1">
            <div className="bg-surface-container px-2 py-1 rounded text-[10px] font-black tracking-tighter text-on-surface-variant uppercase inline-block">
              {appointment.license_plate}
            </div>
            <p className="font-bold text-on-surface line-clamp-1 leading-tight">
              {appointment.company_name}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            {appointment.appointment_purchase_orders && appointment.appointment_purchase_orders.length > 0 ? (
              appointment.appointment_purchase_orders.map(po => (
                <span key={po.id} className="text-[9px] font-black tracking-widest text-primary/60 uppercase bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                  {po.po_number}
                </span>
              ))
            ) : (
              <span className="text-[9px] font-black tracking-widest text-primary/40 uppercase">
                {appointment.po_number || "SIN PO"}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pl-2">
          <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[16px] opacity-40">schedule</span>
            <span className="text-xs">{formatTime(appointment.scheduled_time)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[16px] opacity-40">inventory_2</span>
            <span className="text-xs">
              {appointment.appointment_purchase_orders?.reduce((sum, po) => sum + (po.box_count || 0), 0) || appointment.box_count || 0} cjs
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-surface-container pl-2">
          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase truncate max-w-[100px]" title={appointment.driver_name}>
            {appointment.driver_name}
          </p>
          {appointment.dock_id ? (
            <div className="flex items-center gap-1 text-tertiary font-bold text-[10px]">
              <span className="material-symbols-outlined text-[14px]">meeting_room</span>
              DOK {appointment.dock_name || appointment.dock_id}
            </div>
          ) : (
            <div className="text-[9px] font-bold text-on-surface-variant/40 italic">SIN MUELLE</div>
          )}
        </div>

        {/* Trazabilidad & KPIs Extendidos */}
        {(appointment.arrival_time || appointment.punctuality_status || appointment.force_reason) && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-container pl-2 bg-surface-container-lowest/50 -mx-5 -mb-5 p-3 rounded-b-xl">
            {/* Indicadores de Tiempos Vitales */}
            <div className="flex items-center justify-between">
              {appointment.arrival_time && (
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] opacity-40 text-primary">timer</span>
                  <span className="text-[9px] font-black uppercase text-primary tracking-widest">
                    Espera: {appointment.start_unloading_time 
                      ? `${Math.round((new Date(appointment.start_unloading_time).getTime() - new Date(appointment.arrival_time).getTime()) / 60000)}m` 
                      : `${Math.round((new Date().getTime() - new Date(appointment.arrival_time).getTime()) / 60000)}m`
                    }
                  </span>
                </div>
              )}
              {appointment.punctuality_status && appointment.punctuality_status !== 'N/A (Sin Cita)' && (
                <span className={cn(
                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest",
                  appointment.punctuality_status === 'TARDE' ? "bg-red-100 text-red-700" :
                  appointment.punctuality_status === 'A_TIEMPO' ? "bg-green-100 text-green-700" :
                  "bg-blue-100 text-blue-700"
                )}>
                  {appointment.punctuality_status.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Comentarios o Motivos de Forzado */}
            {appointment.force_reason && (
              <div className="flex items-start gap-1 mt-1 bg-amber-50 p-1.5 rounded border border-amber-100">
                <span className="material-symbols-outlined text-[12px] text-amber-600 mt-0.5">warning</span>
                <p className="text-[9px] font-medium text-amber-800 leading-tight line-clamp-2" title={appointment.force_reason}>
                  <span className="font-bold">Forzado:</span> {appointment.force_reason}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
