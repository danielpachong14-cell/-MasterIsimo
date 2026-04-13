"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { createClient } from "@/lib/supabase/client"
import { Appointment, AppointmentStatus } from "@/types"
import { KanbanColumn } from "./KanbanColumn"
import { KanbanCard } from "./KanbanCard"

const COLUMNS: { id: AppointmentStatus; title: string }[] = [
  { id: 'PENDIENTE', title: 'Pendientes' },
  { id: 'EN_PORTERIA', title: 'En Portería' },
  { id: 'EN_MUELLE', title: 'En Muelle' },
  { id: 'DESCARGANDO', title: 'Descargando' },
  { id: 'FINALIZADO', title: 'Finalizado' },
]

interface KanbanBoardProps {
  appointments: Appointment[];
  onStatusChange: (id: string, newStatus: AppointmentStatus) => Promise<void>;
}

export function KanbanBoard({ appointments, onStatusChange }: KanbanBoardProps) {
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null)

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Sensors
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const appointment = appointments.find((a) => a.id === active.id)
    if (appointment) setActiveAppointment(appointment)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const isActiveInColumn = COLUMNS.some(col => col.id === overId)
    
    if (isActiveInColumn) {
      // Logic for dropping into empty column handled in drag end or over
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveAppointment(null)
    if (!over) return

    const activeId = active.id
    const overId = over.id as AppointmentStatus | string

    const appointment = appointments.find((a) => a.id === activeId)
    if (!appointment) return

    // If dropped over a column or over an item in a column
    let newStatus: AppointmentStatus = appointment.status
    
    if (COLUMNS.some(col => col.id === overId)) {
        newStatus = overId as AppointmentStatus
    } else {
        const overAppointment = appointments.find(a => a.id === overId)
        if (overAppointment) newStatus = overAppointment.status
    }

    if (newStatus !== appointment.status) {
      await onStatusChange(activeId, newStatus)
    }
  }

  return (
    <div className="flex h-[calc(100vh-280px)] space-x-6 overflow-x-auto pb-6 no-scrollbar">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            appointments={appointments.filter((a) => a.status === column.id)}
          />
        ))}

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.4' } }
          })
        }}>
          {activeAppointment ? (
            <KanbanCard appointment={activeAppointment} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
