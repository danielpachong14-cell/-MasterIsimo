import { parseTime } from "@/lib/services/scheduling"
import { TimelineAppointmentRow } from "@/lib/services/appointments"

interface TimelineConfig {
  startMin: number
  zoomLevel: number
  cellWidth: number
}

export function useTimelineCalculations(config: TimelineConfig) {
  const { startMin, zoomLevel, cellWidth } = config

  const getPositionFromMinutes = (minutes: number) => {
    return ((minutes - startMin) / zoomLevel) * cellWidth
  }

  const getWidthFromMinutes = (minutes: number) => {
    return (minutes / zoomLevel) * cellWidth
  }

  const snapToGrid = (deltaX: number) => {
    const slotDelta = Math.round(deltaX / cellWidth)
    return slotDelta * zoomLevel
  }

  const getGhostBlockStyle = (appointment: TimelineAppointmentRow) => {
    const aStart = parseTime(appointment.scheduled_time)
    const aEnd = appointment.scheduled_end_time 
      ? parseTime(appointment.scheduled_end_time) 
      : aStart + (appointment.estimated_duration_minutes || 60)

    const left = getPositionFromMinutes(aStart)
    const width = getWidthFromMinutes(aEnd - aStart)
    
    return { left, width: Math.max(width, cellWidth / 2) }
  }

  const getRealBlockStyle = (
    appointment: TimelineAppointmentRow, 
    currentMinOfDay: number, 
    isToday: boolean
  ) => {
    const hasStartedPhysical = ["EN_MUELLE", "DESCARGANDO", "FINALIZADO"].includes(appointment.status)
    
    let aStart = parseTime(appointment.scheduled_time)
    if (hasStartedPhysical && appointment.docking_time) {
      aStart = parseTime(appointment.docking_time)
    }

    let plannedDuration = appointment.estimated_duration_minutes || 60
    if (appointment.scheduled_end_time) {
      plannedDuration = parseTime(appointment.scheduled_end_time) - parseTime(appointment.scheduled_time)
    }
      
    let aEnd = aStart + plannedDuration
    let isDelayed = false

    if (appointment.status === 'FINALIZADO' && appointment.end_unloading_time) {
      aEnd = parseTime(appointment.end_unloading_time)
    } else if (appointment.status === 'DESCARGANDO' && isToday) {
      if (currentMinOfDay >= aEnd) {
        isDelayed = true
        aEnd = currentMinOfDay
      }
    }

    const left = getPositionFromMinutes(aStart)
    const width = getWidthFromMinutes(aEnd - aStart)

    return { 
      left, 
      width: Math.max(width, cellWidth / 2), 
      isDelayed,
      hasStartedPhysical 
    }
  }

  return {
    getPositionFromMinutes,
    getWidthFromMinutes,
    snapToGrid,
    getGhostBlockStyle,
    getRealBlockStyle
  }
}
