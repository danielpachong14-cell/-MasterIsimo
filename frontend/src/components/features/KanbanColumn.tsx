"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Appointment, AppointmentStatus } from "@/types"
import { KanbanCard } from "./KanbanCard"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  id: AppointmentStatus
  title: string
  appointments: Appointment[]
  onCardClick?: (appointment: Appointment) => void
}

export function KanbanColumn({ id, title, appointments, onCardClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div className="flex flex-col h-full bg-surface-container-low/40 rounded-2xl min-w-[320px] max-w-[380px]">
      {/* Column Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            id === 'PENDIENTE' && "bg-surface-container-highest",
            id === 'EN_PORTERIA' && "bg-secondary-fixed-dim",
            id === 'EN_MUELLE' && "bg-tertiary-fixed",
            id === 'DESCARGANDO' && "bg-tertiary",
            id === 'FINALIZADO' && "bg-primary",
          )} />
          <h3 className="text-xs font-black tracking-[0.2em] text-on-surface-variant uppercase">
            {title}
          </h3>
        </div>
        <div className="bg-white/80 px-2 py-0.5 rounded text-[10px] font-black text-primary/60 border border-primary/5">
          {appointments.length}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-3"
      >
        <SortableContext
          id={id}
          items={appointments.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {appointments.map((appointment) => (
            <KanbanCard key={appointment.id} appointment={appointment} onClick={onCardClick} />
          ))}
          
          {appointments.length === 0 && (
            <div className="h-32 border-2 border-dashed border-surface-container-highest rounded-2xl flex flex-col items-center justify-center text-on-surface-variant/20 space-y-2">
              <span className="material-symbols-outlined text-4xl">inbox</span>
              <span className="text-[10px] font-bold tracking-widest uppercase">Vacío</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
