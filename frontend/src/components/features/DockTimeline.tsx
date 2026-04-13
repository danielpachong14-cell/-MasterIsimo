"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Appointment, Dock, CediSettings } from "@/types"
import { parseTime } from "@/lib/services/scheduling"
import { cn } from "@/lib/utils"

interface DockTimelineProps {
  date: string
  appointments: Appointment[]
  docks: Dock[]
  settings: CediSettings
  onAppointmentMove: (appointmentId: string, newDockId: number, newStartTime: string) => void
  onAppointmentExtend: (appointmentId: string, newEndTime?: string) => void
  onAppointmentEdit: (appointment: Appointment) => void
}

const ROW_HEIGHT = 72 // px per dock row
const HEADER_HEIGHT = 48
const DOCK_LABEL_WIDTH = 120

type ZoomLevel = 5 | 15 | 30 | 60;

export function DockTimeline({ date, appointments, docks, settings, onAppointmentMove, onAppointmentExtend, onAppointmentEdit }: DockTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 🔍 Zoom Logic
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(30)
  const cellWidth = zoomLevel === 5 ? 40 : zoomLevel === 15 ? 60 : zoomLevel === 30 ? 90 : 150;
  
  const [dragState, setDragState] = useState<{
    appointmentId: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    originalDockId: number
    originalStartMin: number
  } | null>(null)

  const [resizingState, setResizingState] = useState<{
    appointmentId: string
    startWidth: number
    startX: number
    currentWidth: number
    dockId: number
    originalEndMin: number
  } | null>(null)

  const startMin = parseTime(settings.start_time)
  const endMin = parseTime(settings.end_time)
  const totalSlots = Math.ceil((endMin - startMin) / zoomLevel)

  // Generate time headers
  const timeHeaders = useMemo(() => {
    const headers: string[] = []
    for (let i = 0; i < totalSlots; i++) {
      const min = startMin + i * zoomLevel
      const h = Math.floor(min / 60)
      const m = min % 60
      headers.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    }
    return headers
  }, [startMin, totalSlots, zoomLevel])

  // Calculate block positioning
  const getBlockStyle = (appointment: Appointment) => {
    const aStart = parseTime(appointment.scheduled_time)
    const aEnd = appointment.scheduled_end_time 
      ? parseTime(appointment.scheduled_end_time) 
      : aStart + (appointment.estimated_duration_minutes || 60)

    const leftOffset = ((aStart - startMin) / zoomLevel) * cellWidth
    const width = ((aEnd - aStart) / zoomLevel) * cellWidth

    return { left: leftOffset, width: Math.max(width, cellWidth / 2) }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDIENTE': return 'bg-surface-container-highest/80 border-on-surface-variant/20 text-on-surface-variant'
      case 'EN_PATIO': return 'bg-secondary-fixed/80 border-secondary/30 text-on-secondary-fixed-variant'
      case 'EN_MUELLE': return 'bg-tertiary-fixed/60 border-tertiary/30 text-on-tertiary-fixed-variant'
      case 'DESCARGANDO': return 'bg-tertiary-fixed border-tertiary/40 text-on-tertiary-fixed-variant'
      case 'FINALIZADO': return 'bg-primary-fixed/80 border-primary/20 text-on-primary-fixed-variant'
      default: return 'bg-surface-container border-outline-variant text-on-surface-variant'
    }
  }

  // ─── Drag Handlers ────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent, appointment: Appointment) => {
    if (!appointment.dock_id) return
    e.preventDefault()
    setDragState({
      appointmentId: appointment.id,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      originalDockId: appointment.dock_id,
      originalStartMin: parseTime(appointment.scheduled_time),
    })
  }

  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null)
    }

    const handleMouseUp = () => {
      if (!dragState || !containerRef.current) {
        setDragState(null)
        return
      }

      const deltaX = dragState.currentX - dragState.startX
      const deltaY = dragState.currentY - dragState.startY

      // Calculate new time (snap to grid)
      const slotDelta = Math.round(deltaX / cellWidth)
      const newStartMin = dragState.originalStartMin + slotDelta * zoomLevel

      // Calculate new dock
      const rowDelta = Math.round(deltaY / ROW_HEIGHT)
      const originalDockIndex = docks.findIndex(d => d.id === dragState.originalDockId)
      const newDockIndex = Math.max(0, Math.min(docks.length - 1, originalDockIndex + rowDelta))
      const newDockId = docks[newDockIndex]?.id

      // Only trigger if something actually changed
      if (newDockId && (slotDelta !== 0 || rowDelta !== 0)) {
        const h = Math.floor(newStartMin / 60)
        const m = newStartMin % 60
        const newTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
        onAppointmentMove(dragState.appointmentId, newDockId, newTimeStr)
      }

      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, docks, onAppointmentMove])

  // ─── Resize Handlers ──────────────────────────────────────
  const handleResizeDown = (e: React.MouseEvent, appointment: Appointment) => {
    e.preventDefault()
    e.stopPropagation()
    const { width } = getBlockStyle(appointment)
    setResizingState({
      appointmentId: appointment.id,
      startWidth: width,
      startX: e.clientX,
      currentWidth: width,
      dockId: appointment.dock_id!,
      originalEndMin: parseTime(appointment.scheduled_end_time || '') || (parseTime(appointment.scheduled_time) + (appointment.estimated_duration_minutes || 60))
    })
  }

  useEffect(() => {
    if (!resizingState) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingState.startX
      setResizingState(prev => prev ? { ...prev, currentWidth: Math.max(cellWidth / 2, resizingState.startWidth + deltaX) } : null)
    }

    const handleMouseUp = () => {
      if (!resizingState) return
      
      const deltaX = resizingState.currentWidth - resizingState.startWidth
      const slotDelta = Math.round(deltaX / cellWidth)
      
      if (slotDelta !== 0) {
        const newEndMin = resizingState.originalEndMin + slotDelta * zoomLevel
        const h = Math.floor(newEndMin / 60)
        const m = newEndMin % 60
        const newEndTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
        
        // Trigger save (We'll update muelles/page.tsx to handle this)
        onAppointmentExtend(resizingState.appointmentId, newEndTimeStr)
      }
      
      setResizingState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingState, onAppointmentExtend])

  // 🕒 Current Time Tracker (Real-time update)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const todayStr = currentTime.toISOString().split('T')[0]
  const isToday = date === todayStr
  const currentMinOfDay = currentTime.getHours() * 60 + currentTime.getMinutes()
  const currentTimeOffset = isToday && currentMinOfDay >= startMin && currentMinOfDay <= endMin
    ? ((currentMinOfDay - startMin) / zoomLevel) * cellWidth
    : null

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* 🔍 Zoom Controls Overlay */}
      <div className="absolute right-8 top-16 z-50 flex items-center gap-1 bg-surface-container-high/60 backdrop-blur-md p-1.5 rounded-2xl border border-surface-container shadow-2xl">
        <button 
          onClick={() => setZoomLevel(60)}
          className={cn(
            "px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all",
            zoomLevel === 60 ? "bg-primary text-on-primary shadow-lg" : "hover:bg-surface-container-highest text-on-surface-variant"
          )}
        >
          60m
        </button>
        <button 
          onClick={() => setZoomLevel(30)}
          className={cn(
            "px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all",
            zoomLevel === 30 ? "bg-primary text-on-primary shadow-lg" : "hover:bg-surface-container-highest text-on-surface-variant"
          )}
        >
          30m
        </button>
        <button 
          onClick={() => setZoomLevel(15)}
          className={cn(
            "px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all",
            zoomLevel === 15 ? "bg-primary text-on-primary shadow-lg" : "hover:bg-surface-container-highest text-on-surface-variant"
          )}
        >
          15m
        </button>
        <button 
          onClick={() => setZoomLevel(5)}
          className={cn(
            "px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all",
            zoomLevel === 5 ? "bg-primary text-on-primary shadow-lg" : "hover:bg-surface-container-highest text-on-surface-variant"
          )}
        >
          5m
        </button>
      </div>

      <div className="relative overflow-auto rounded-2xl border border-surface-container flex-1" ref={containerRef}>
        <div className="relative" style={{ minWidth: DOCK_LABEL_WIDTH + totalSlots * cellWidth + 20 }}>

        {/* ─── Time Header Row ─── */}
        <div className="flex sticky top-0 z-20 bg-surface-container-low/95 backdrop-blur-sm border-b border-surface-container" style={{ height: HEADER_HEIGHT }}>
          <div className="flex-shrink-0 flex items-center px-4 font-bold text-[10px] uppercase tracking-widest text-primary/40 border-r border-surface-container" style={{ width: DOCK_LABEL_WIDTH }}>
            Muelle
          </div>
          <div className="flex relative">
            {timeHeaders.map((time, i) => (
              <div 
                key={i} 
                className="flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-on-surface-variant/60 border-r border-surface-container/50"
                style={{ width: cellWidth }}
              >
                {time}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Dock Rows ─── */}
        {docks.map((dock, dockIndex) => {
          const dockAppointments = appointments.filter(a => a.dock_id === dock.id)
          
          return (
            <div 
              key={dock.id} 
              className={cn(
                "flex border-b border-surface-container/50 relative",
                dockIndex % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest'
              )} 
              style={{ height: ROW_HEIGHT }}
            >
              {/* Dock Label */}
              <div className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-surface-container sticky left-0 z-10 bg-inherit" style={{ width: DOCK_LABEL_WIDTH }}>
                <div className={`w-2.5 h-2.5 rounded-full ${dock.is_active ? 'bg-tertiary shadow-[0_0_6px_rgba(78,222,163,0.5)]' : 'bg-on-surface-variant/20'}`} />
                <span className="text-xs font-bold text-on-surface truncate">{dock.name}</span>
              </div>

              {/* Grid Background */}
              <div className="flex relative flex-1">
                {timeHeaders.map((_, i) => (
                  <div key={i} className="flex-shrink-0 border-r border-surface-container/30" style={{ width: cellWidth, height: ROW_HEIGHT }} />
                ))}

                {/* Appointment Blocks */}
                {dockAppointments.map(appointment => {
                  const { left, width } = getBlockStyle(appointment)
                  const isDragging = dragState?.appointmentId === appointment.id
                  
                  let transformX = 0, transformY = 0
                  if (isDragging && dragState) {
                    transformX = dragState.currentX - dragState.startX
                    transformY = dragState.currentY - dragState.startY
                  }

                  const totalBoxes = appointment.appointment_purchase_orders?.reduce((s, po) => s + (po.box_count || 0), 0) || appointment.box_count || 0

                  return (
                    <div
                      key={appointment.id}
                      className={cn(
                        "absolute top-1.5 bottom-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-shadow flex flex-col justify-center px-2.5 overflow-hidden group",
                        getStatusColor(appointment.status),
                        isDragging && "shadow-float z-30 opacity-90 scale-[1.02]"
                      )}
                        style={{ 
                          left, 
                          width: resizingState?.appointmentId === appointment.id ? resizingState.currentWidth : width,
                          transform: isDragging ? `translate(${transformX}px, ${transformY}px)` : undefined,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, appointment)}
                        onDoubleClick={() => onAppointmentEdit(appointment)}
                      >
                        {/* Resize Handle */}
                        {(appointment.status !== 'FINALIZADO' && appointment.status !== 'CANCELADO') && (
                          <div 
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 z-10"
                            onMouseDown={(e) => handleResizeDown(e, appointment)}
                          />
                        )}

                        <div className="flex-1 flex flex-col min-w-0 pr-6">
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="text-[10px] font-black truncate leading-tight uppercase">{appointment.license_plate}</p>
                            {appointment.is_walk_in && (
                              <span className="material-symbols-outlined text-[11px] text-amber-500 shrink-0">bolt</span>
                            )}
                          </div>

                          {/* PO numbers list */}
                          <div className="mt-0.5 flex flex-wrap gap-0.5 max-h-[16px] overflow-hidden group-hover:max-h-none transition-all">
                            {appointment.appointment_purchase_orders?.map(po => (
                              <span key={po.id} className="text-[8px] bg-black/5 px-1 rounded font-bold text-on-surface/60">
                                #{po.po_number}
                              </span>
                            ))}
                          </div>
                          
                          <p className="text-[9px] font-bold truncate text-on-surface/80 tracking-tight mt-0.5">{appointment.company_name}</p>
                          
                          <div className="flex items-center gap-2 mt-auto pb-0.5">
                            <p className="text-[9px] font-black flex items-center gap-0.5 text-on-surface/70">
                              <span className="material-symbols-outlined text-[11px]">inventory_2</span>
                              {totalBoxes}
                            </p>
                            <p className="text-[9px] font-black flex items-center gap-0.5 text-on-surface/70">
                              <span className="material-symbols-outlined text-[11px]">schedule</span>
                              {appointment.estimated_duration_minutes}m
                            </p>
                          </div>
                        </div>

                        {/* Edit Button (replacing the simple +) */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAppointmentEdit(appointment) }}
                          className="absolute right-1 top-1 bg-white border border-surface-container shadow-sm p-1 rounded-lg hover:bg-surface-container transition-all group/btn"
                          title="Gestionar Tiempo y Datos"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary group-hover/btn:scale-110 transition-transform">add_circle</span>
                        </button>
                      </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ─── Current Time Indicator (Vertical Line) ─── */}
        {currentTimeOffset !== null && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-error/40 z-30 pointer-events-none border-r border-error/20"
            style={{ left: DOCK_LABEL_WIDTH + currentTimeOffset }}
          >
            {/* Top indicator dot */}
            <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-error rounded-full shadow-[0_0_10px_rgba(255,82,82,0.6)] border-2 border-white" />
            
            {/* Pulsing effect for the dot */}
            <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-error rounded-full animate-ping opacity-30" />
            
            {/* Current time label (Optional, but helpful) */}
            <div className="absolute top-10 -left-6 bg-error text-white text-[8px] font-bold px-1 rounded-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              {currentTime.getHours()}:{currentTime.getMinutes().toString().padStart(2, '0')}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}
