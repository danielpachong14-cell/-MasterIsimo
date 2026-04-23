"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { CediSettings } from "@/types"
import { TimelineAppointmentRow, TimelineDockRow } from "@/lib/services/appointments"
import { parseTime } from "@/lib/services/scheduling"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/store/uiStore"

// Sub-components & Hook
import { useTimelineCalculations } from "./timeline/useTimelineCalculations"
import { AppointmentBlock } from "./timeline/AppointmentBlock"
import { AppointmentDrawer } from "./timeline/AppointmentDrawer"
import { DockRow } from "./timeline/DockRow"

interface DockTimelineProps {
  date: string
  appointments: TimelineAppointmentRow[]
  docks: TimelineDockRow[]
  settings: CediSettings
  onAppointmentMove: (appointmentId: string, newDockId: number, newStartTime: string) => void
  onAppointmentExtend: (appointmentId: string, newEndTime?: string) => void
  onAppointmentEdit: (appointment: TimelineAppointmentRow) => void
  onAutoExtend?: (appointmentId: string) => void
  onDropFromWaitlist?: (appointmentId: string, dockId: number, startTimeStr: string) => void
}

const ROW_HEIGHT = 72
const HEADER_HEIGHT = 48
const DOCK_LABEL_WIDTH = 120

type ZoomLevel = 5 | 15 | 30 | 60

export function DockTimeline({ 
  date, 
  appointments, 
  docks, 
  settings, 
  onAppointmentMove, 
  onAppointmentExtend, 
  onAppointmentEdit, 
  onAutoExtend, 
  onDropFromWaitlist 
}: DockTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { openTimelineDrawer } = useUIStore()
  
  // 🔍 UI State
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(30)
  const cellWidth = zoomLevel === 5 ? 40 : zoomLevel === 15 ? 60 : zoomLevel === 30 ? 90 : 150
  const [visibleLayers, setVisibleLayers] = useState({ plan: true, operation: true, history: true })
  
  // 🕒 Time Reference
  const startMin = useMemo(() => parseTime(settings.start_time), [settings.start_time])
  const endMin = useMemo(() => parseTime(settings.end_time), [settings.end_time])
  const totalSlots = Math.ceil((endMin - startMin) / zoomLevel)

  // 🕒 Current Time Tracker
  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const currentMinOfDay = currentTime.getHours() * 60 + currentTime.getMinutes()
  const isToday = date === currentTime.toISOString().split('T')[0]

  // 🕒 Auto Extend Detection
  useEffect(() => {
    if (!isToday || !onAutoExtend) return
    
    appointments.forEach(appt => {
      if (appt.status === 'DESCARGANDO') {
        const aStart = parseTime(appt.scheduled_time)
        const apptEndMin = appt.scheduled_end_time 
          ? parseTime(appt.scheduled_end_time) 
          : aStart + (appt.estimated_duration_minutes || 60)
        
        if (currentMinOfDay >= apptEndMin) {
          onAutoExtend(appt.id)
        }
      }
    })
  }, [currentMinOfDay, appointments, isToday, onAutoExtend])

  // 🧮 Calculation Hook
  const { 
    snapToGrid, 
    getGhostBlockStyle, 
    getRealBlockStyle,
    getPositionFromMinutes 
  } = useTimelineCalculations({ startMin, zoomLevel, cellWidth })

  // 🖱️ Interaction State
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
    originalEndMin: number
  } | null>(null)

  // ─── Interaction Handlers ──────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent, appointment: TimelineAppointmentRow) => {
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

  const handleResizeDown = (e: React.MouseEvent, appointment: TimelineAppointmentRow) => {
    e.preventDefault()
    e.stopPropagation()
    const { width } = getGhostBlockStyle(appointment)
    setResizingState({
      appointmentId: appointment.id,
      startWidth: width,
      startX: e.clientX,
      currentWidth: width,
      originalEndMin: parseTime(appointment.scheduled_end_time || '') || 
                     (parseTime(appointment.scheduled_time) + (appointment.estimated_duration_minutes || 60))
    })
  }

  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null)
    }

    const handleMouseUp = () => {
      if (!dragState) return

      const deltaX = dragState.currentX - dragState.startX
      const deltaY = dragState.currentY - dragState.startY

      const timeDelta = snapToGrid(deltaX)
      const newStartMin = dragState.originalStartMin + timeDelta

      const rowDelta = Math.round(deltaY / ROW_HEIGHT)
      const originalDockIndex = docks.findIndex(d => d.id === dragState.originalDockId)
      const newDockIndex = Math.max(0, Math.min(docks.length - 1, originalDockIndex + rowDelta))
      const newDockId = docks[newDockIndex]?.id

      if (newDockId && (timeDelta !== 0 || rowDelta !== 0)) {
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
  }, [dragState, docks, onAppointmentMove, snapToGrid])

  useEffect(() => {
    if (!resizingState) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingState.startX
      setResizingState(prev => prev ? { ...prev, currentWidth: Math.max(cellWidth / 2, resizingState.startWidth + deltaX) } : null)
    }

    const handleMouseUp = () => {
      if (!resizingState) return
      
      const deltaX = resizingState.currentWidth - resizingState.startWidth
      const timeDelta = snapToGrid(deltaX)
      
      if (timeDelta !== 0) {
        const newEndMin = resizingState.originalEndMin + timeDelta
        const h = Math.floor(newEndMin / 60)
        const m = newEndMin % 60
        const newEndTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
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
  }, [resizingState, onAppointmentExtend, cellWidth, snapToGrid])

  // ─── Drop from Waitlist ────────────────────────────────────
  const handleDrop = (e: React.DragEvent, dockId: number) => {
    e.preventDefault()
    const appointmentId = e.dataTransfer.getData('text/plain')
    if (!appointmentId || !onDropFromWaitlist) return

    const rect = e.currentTarget.getBoundingClientRect()
    const dropX = e.clientX - rect.left - DOCK_LABEL_WIDTH
    
    if (dropX < 0) return

    const timeDelta = snapToGrid(dropX)
    const newStartMin = startMin + timeDelta
    const h = Math.floor(newStartMin / 60)
    const m = newStartMin % 60
    const newTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`

    onDropFromWaitlist(appointmentId, dockId, newTimeStr)
  }

  // ─── Helpers ───────────────────────────────────────────────
  const timeHeaders = useMemo(() => {
    return Array.from({ length: totalSlots }).map((_, i) => {
      const min = startMin + i * zoomLevel
      const h = Math.floor(min / 60)
      const m = min % 60
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    })
  }, [startMin, totalSlots, zoomLevel])

  const currentTimeOffset = isToday && currentMinOfDay >= startMin && currentMinOfDay <= endMin
    ? getPositionFromMinutes(currentMinOfDay)
    : null

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-2xl border border-surface-container shadow-sm">
      {/* 🛠️ Timeline Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-container bg-surface-container-lowest">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">Controles de Vista</span>
          </div>
          
          <div className="flex items-center gap-1 bg-surface-container-high/50 p-1 rounded-xl border border-surface-container/50">
            <LayerButton 
              active={visibleLayers.plan} 
              onClick={() => setVisibleLayers(p => ({ ...p, plan: !p.plan }))}
              icon="calendar_today" 
              label="Plan" 
            />
            <LayerButton 
              active={visibleLayers.operation} 
              onClick={() => setVisibleLayers(p => ({ ...p, operation: !p.operation }))}
              icon="local_shipping" 
              label="Operación" 
              tertiary 
            />
            <LayerButton 
              active={visibleLayers.history} 
              onClick={() => setVisibleLayers(p => ({ ...p, history: !p.history }))}
              icon="history" 
              label="Histórico" 
              variant 
            />
          </div>
        </div>

        <div className="flex items-center gap-1 bg-surface-container-high/50 p-1 rounded-xl border border-surface-container/50">
          {[60, 30, 15, 5].map(lvl => (
            <button 
              key={lvl}
              onClick={() => setZoomLevel(lvl as ZoomLevel)}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                zoomLevel === lvl 
                  ? "bg-primary text-on-primary shadow-md" 
                  : "hover:bg-surface-container-highest text-on-surface-variant"
              )}
            >
              {lvl}m
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-auto flex-1" ref={containerRef}>
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
          {docks.map((dock, dockIndex) => (
            <DockRow
              key={dock.id}
              dock={dock}
              index={dockIndex}
              cellWidth={cellWidth}
              timeHeadersCount={timeHeaders.length}
              rowHeight={ROW_HEIGHT}
              labelWidth={DOCK_LABEL_WIDTH}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {appointments
                .filter(a => a.dock_id === dock.id)
                .map(appointment => (
                  <AppointmentBlock
                    key={appointment.id}
                    appointment={appointment}
                    ghostStyle={getGhostBlockStyle(appointment)}
                    realStyle={getRealBlockStyle(appointment, currentMinOfDay, isToday)}
                    visibleLayers={visibleLayers}
                    isDragging={dragState?.appointmentId === appointment.id}
                    isResizing={resizingState?.appointmentId === appointment.id}
                    dragTransform={dragState?.appointmentId === appointment.id ? {
                      x: dragState.currentX - dragState.startX,
                      y: dragState.currentY - dragState.startY
                    } : undefined}
                    resizeWidth={resizingState?.appointmentId === appointment.id ? resizingState.currentWidth : undefined}
                    onMouseDown={(e) => handleMouseDown(e, appointment)}
                    onResizeDown={(e) => handleResizeDown(e, appointment)}
                    onEdit={() => onAppointmentEdit(appointment)}
                    onDrawerOpen={() => openTimelineDrawer(appointment)}
                  />
                ))}
            </DockRow>
          ))}

          {/* ─── Current Time Indicator ─── */}
          {currentTimeOffset !== null && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-error/40 z-30 pointer-events-none border-r border-error/20"
              style={{ left: DOCK_LABEL_WIDTH + currentTimeOffset }}
            >
              <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-error rounded-full shadow-[0_0_10px_rgba(255,82,82,0.6)] border-2 border-white" />
              <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-error rounded-full animate-ping opacity-30" />
            </div>
          )}
        </div>
      </div>

      {/* ── Appointment Drawer (v4.2) — mounted here to share Gantt context ── */}
      <AppointmentDrawer />
    </div>
  )
}

// ─── Sub-component Utils ────────────────────────────────────

function LayerButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  tertiary, 
  variant 
}: { 
  active: boolean, 
  onClick: () => void, 
  icon: string, 
  label: string, 
  tertiary?: boolean, 
  variant?: boolean 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all flex items-center gap-1",
        active 
          ? tertiary ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" 
          : variant ? "bg-surface-variant text-on-surface-variant"
          : "bg-primary/10 text-primary"
          : "text-on-surface-variant/40 hover:bg-surface-container-highest"
      )}
    >
      <span className="material-symbols-outlined text-[12px]">{icon}</span> {label}
    </button>
  )
}
