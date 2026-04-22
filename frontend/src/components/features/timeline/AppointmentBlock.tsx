"use client"

import { cn } from "@/lib/utils"
import { TimelineAppointmentRow } from "@/lib/services/appointments"
import { formatTimeFromMinutes, parseTime } from "@/lib/services/scheduling"

interface AppointmentBlockProps {
  appointment: TimelineAppointmentRow
  ghostStyle: { left: number, width: number }
  realStyle: { left: number, width: number, isDelayed: boolean, hasStartedPhysical: boolean }
  isDragging: boolean
  isResizing: boolean
  dragTransform?: { x: number, y: number }
  resizeWidth?: number
  visibleLayers: { plan: boolean, operation: boolean, history: boolean }
  onMouseDown: (e: React.MouseEvent) => void
  onResizeDown: (e: React.MouseEvent) => void
  onEdit: () => void
}

export function AppointmentBlock({
  appointment,
  ghostStyle,
  realStyle,
  isDragging,
  isResizing,
  dragTransform,
  resizeWidth,
  visibleLayers,
  onMouseDown,
  onResizeDown,
  onEdit
}: AppointmentBlockProps) {
  const isHistory = appointment.status === 'FINALIZADO'
  const isOperation = appointment.status === 'EN_MUELLE' || appointment.status === 'DESCARGANDO'
  const isPending = appointment.status === 'PENDIENTE' || appointment.status === 'EN_PORTERIA'

  const showPlanLayer = visibleLayers.plan
  const showRealLayer = (isOperation && visibleLayers.operation) || 
                       (isHistory && visibleLayers.history) || 
                       (isPending && visibleLayers.plan)

  if (!showPlanLayer && !showRealLayer) return null

  const getBlockPositioning = (status: string) => {
    if (status === 'FINALIZADO') return 'bottom-0 h-[15%] rounded-t-md'
    if (status === 'PENDIENTE' || status === 'EN_PORTERIA') return 'top-[30%] bottom-[30%] rounded-lg'
    return 'top-0.5 bottom-0.5 rounded-lg'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDIENTE': return 'bg-surface-container-highest/30 border-on-surface-variant/20 border-dashed text-on-surface-variant/60 opacity-70'
      case 'EN_PORTERIA': return 'bg-secondary-fixed/30 border-secondary/30 border-dashed text-on-secondary-fixed-variant opacity-80'
      case 'EN_MUELLE': return 'bg-tertiary-fixed/20 border-tertiary/30 text-on-tertiary-fixed-variant shadow-sm backdrop-blur-[2px]'
      case 'DESCARGANDO': return 'bg-tertiary-fixed border-tertiary-fixed-dim text-on-tertiary-fixed shadow-elevated'
      case 'FINALIZADO': return 'bg-surface-variant border-none text-on-surface-variant/40' // Changed from text-transparent to show some info if needed
      default: return 'bg-surface-container border-outline-variant text-on-surface-variant'
    }
  }

  const totalBoxes = appointment.appointment_purchase_orders?.reduce((s, po) => s + (po.box_count || 0), 0) || appointment.box_count || 0
  const transformStyle = dragTransform ? { transform: `translate(${dragTransform.x}px, ${dragTransform.y}px)` } : {}

  return (
    <div className="contents">
      {/* GHOST BLOCK (Planned) */}
      {realStyle.hasStartedPhysical && showPlanLayer && (
        <div
          className="absolute top-[30%] bottom-[30%] rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 pointer-events-none z-10"
          style={{
            left: ghostStyle.left,
            width: ghostStyle.width,
            ...transformStyle
          }}
        />
      )}

      {/* REAL BLOCK (Operational) */}
      {showRealLayer && (
        <div
          className={cn(
            "absolute border cursor-grab active:cursor-grabbing transition-shadow flex flex-col justify-center px-2.5 overflow-hidden group/appt shadow-sm",
            getBlockPositioning(appointment.status),
            getStatusColor(appointment.status),
            isDragging && "shadow-float z-40 opacity-90 scale-[1.02]",
            !realStyle.hasStartedPhysical && "z-20",
            realStyle.hasStartedPhysical && "z-30",
            realStyle.isDelayed && "bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)] border-warning/60"
          )}
          style={{ 
            left: realStyle.hasStartedPhysical ? realStyle.left : ghostStyle.left, 
            width: isResizing ? resizeWidth : (realStyle.hasStartedPhysical ? realStyle.width : ghostStyle.width),
            ...transformStyle
          }}
          onMouseDown={onMouseDown}
          onDoubleClick={onEdit}
          title={isHistory ? `Placa: ${appointment.license_plate} | Empresa: ${appointment.company_name} | Inicio: ${appointment.docking_time ? formatTimeFromMinutes(parseTime(appointment.docking_time)) : '-'} | Fin: ${appointment.end_unloading_time ? formatTimeFromMinutes(parseTime(appointment.end_unloading_time)) : '-'}` : undefined}
        >
          {/* Resize Handle */}
          {(appointment.status !== 'FINALIZADO' && appointment.status !== 'CANCELADO') && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 z-10"
              onMouseDown={onResizeDown}
            />
          )}

          {!isHistory && (
            <>
              <div className="flex-1 flex flex-col min-w-0 pr-6">
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <p className="text-[10px] font-black truncate leading-tight uppercase">{appointment.license_plate}</p>
                  {appointment.status === 'DESCARGANDO' && (
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary-container"></span>
                    </span>
                  )}
                  {appointment.is_walk_in && !appointment.status.includes('DESCARGANDO') && (
                    <span className="material-symbols-outlined text-[11px] text-amber-500 shrink-0">bolt</span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap gap-0.5 max-h-[16px] overflow-hidden group-hover:max-h-none transition-all">
                  {appointment.appointment_purchase_orders?.map(po => (
                    <span key={po.id} className="text-[8px] bg-black/5 px-1 rounded font-bold text-on-surface/60">
                      #{po.po_number}
                    </span>
                  ))}
                </div>
                
                <p className="text-[9px] font-bold truncate text-on-surface/80 tracking-tight mt-0.5">{appointment.company_name}</p>
                
                <div className="flex items-center gap-2 mt-auto pb-0.5">
                  <p className="text-[9px] font-black flex items-center gap-0.5 opacity-70">
                    <span className="material-symbols-outlined text-[11px]">inventory_2</span>
                    {totalBoxes}
                  </p>
                  <p className="text-[9px] font-black flex items-center gap-0.5 opacity-70">
                    <span className="material-symbols-outlined text-[11px]">schedule</span>
                    {appointment.estimated_duration_minutes}m
                  </p>
                  {appointment.docking_time && (
                    <p className="text-[9px] font-black flex items-center gap-0.5 text-tertiary-container bg-tertiary/10 px-1 rounded">
                      <span className="material-symbols-outlined text-[11px]">dock</span>
                      {formatTimeFromMinutes(parseTime(appointment.docking_time))}
                    </p>
                  )}
                </div>
              </div>

              <button 
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                className="absolute right-1 top-1 bg-white border border-surface-container shadow-sm p-1 rounded-lg hover:bg-surface-container transition-all group-hover/appt:opacity-100 opacity-0"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">add_circle</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
