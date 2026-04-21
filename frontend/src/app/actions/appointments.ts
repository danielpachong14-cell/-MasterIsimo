"use server"
import { createClient } from "@/lib/supabase/server"
import { 
  checkDockAvailability, 
  runSchedulingEngine, 
  parseTime, 
  formatTimeFromMinutes 
} from "@/lib/services/scheduling-engine"
import { buildStatusTransitionUpdates } from "@/lib/services/appointments"
import type { AppointmentStatus } from "@/types"

export async function assignDockAction({
  appointmentId,
  dockId,
  scheduledDate,
  scheduledTime,
  newStatus,
  forceReason
}: {
  appointmentId: string;
  dockId: number;
  scheduledDate?: string;
  scheduledTime?: string;
  newStatus?: AppointmentStatus;
  forceReason?: string;
}) {
  const supabase = await createClient()

  // 1. Obtener datos maestros de la cita (Zero Over-fetching)
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select(`
      id, 
      scheduled_date, 
      scheduled_time, 
      environment_id, 
      vehicle_type_id, 
      status, 
      arrival_time, 
      docking_time, 
      start_unloading_time, 
      end_unloading_time, 
      box_count,
      appointment_purchase_orders(box_count)
    `)
    .eq("id", appointmentId)
    .single()

  if (apptError || !appointment) {
    return { success: false, error: "Cita no encontrada." }
  }

  // 2. Cálculo Dinámico de Duración (Requisito del Veredicto)
  const targetDate = scheduledDate || appointment.scheduled_date
  // Sanitizar targetTime: Si viene de Postgres TIMETZ puede traer +00, tomamos solo HH:mm:ss
  const rawTime = scheduledTime || appointment.scheduled_time || "00:00:00"
  const targetTime = rawTime.includes("+") ? rawTime.split("+")[0] : rawTime

  // Calcular totalBoxes real (Sumando POs si están disponibles)
  const poTotal = (appointment.appointment_purchase_orders || []).reduce(
    (sum: number, po: { box_count: number }) => sum + (po.box_count || 0), 
    0
  )
  const totalBoxes = poTotal || appointment.box_count || 0

  const engineResult = await runSchedulingEngine(supabase, {
    date: targetDate,
    environmentId: appointment.environment_id,
    vehicleTypeId: appointment.vehicle_type_id,
    totalBoxes: totalBoxes
  })

  const duration = engineResult.durationMinutes
  const startTimeMin = parseTime(targetTime)
  const endTimeStr = formatTimeFromMinutes(startTimeMin + duration)

  // 3. Validación de Muelle (Compatibilidad)
  const { data: dock, error: dockError } = await supabase
    .from("docks")
    .select("id, name, environment_id, supported_vehicle_types")
    .eq("id", dockId)
    .single()

  if (dockError || !dock) {
    return { success: false, error: "Muelle no encontrado o inactivo." }
  }

  if (dock.environment_id && appointment.environment_id && dock.environment_id !== appointment.environment_id) {
    return { success: false, error: `Muelle incompatible con el ambiente (${appointment.environment_id}).` }
  }

  if (dock.supported_vehicle_types && dock.supported_vehicle_types.length > 0 && appointment.vehicle_type_id) {
    if (!dock.supported_vehicle_types.includes(appointment.vehicle_type_id)) {
      return { success: false, error: "Muelle no soporta este tipo de vehículo." }
    }
  }

  // 4. Detección de Colisiones (Server-First)
  const availability = await checkDockAvailability(
    supabase,
    dockId,
    targetDate,
    startTimeMin,
    duration,
    appointmentId
  )

  if (!availability.available && !forceReason) {
    return { 
      success: false, 
      error: `Conflicto detectado en el muelle ${dock.name} con el vehículo ${availability.conflictWith}.`,
      isConflict: true
    }
  }

  // 5. Preparar Updates con Trazabilidad (Helper buildStatusTransitionUpdates)
  let updates: Record<string, unknown> = {
    dock_id: dockId,
    scheduled_date: targetDate,
    scheduled_time: targetTime,
    scheduled_end_time: endTimeStr,
    estimated_duration_minutes: duration
  }

  if (forceReason) {
    updates.force_reason = forceReason
    updates.is_forced_assignment = true
  }

  if (newStatus) {
    const statusUpdates = buildStatusTransitionUpdates(appointment, newStatus)
    updates = { ...updates, ...statusUpdates }
  }

  // 6. Persistir Cambios
  const { error: updateError } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId)

  if (updateError) {
    console.error("Error updating appointment dock:", updateError)
    return { success: false, error: "Error al actualizar la base de datos." }
  }

  return { success: true }
}

export async function shiftAndExtendAppointmentAction({
  appointmentId,
  newDockId,
  newStartTime,
  newEndTime
}: {
  appointmentId: string;
  newDockId?: number;
  newStartTime?: string;
  newEndTime?: string;
}) {
  const supabase = await createClient()

  // 1. Obtener la cita principal
  const { data: targetAppt, error: targetError } = await supabase
    .from("appointments")
    .select("id, dock_id, scheduled_date, scheduled_time, scheduled_end_time, estimated_duration_minutes, status, arrival_time, docking_time, start_unloading_time, end_unloading_time")
    .eq("id", appointmentId)
    .single()

  if (targetError || !targetAppt) {
    return { success: false, error: "Cita no encontrada." }
  }

  const finalDockId = newDockId ?? targetAppt.dock_id
  
  if (!finalDockId) {
    return { success: false, error: "La cita no tiene un muelle asignado para reubicar." }
  }

  const finalStartTimeStr = newStartTime ?? targetAppt.scheduled_time
  const finalStartMin = parseTime(finalStartTimeStr)
  
  let finalEndMin: number;
  if (newEndTime) {
    finalEndMin = parseTime(newEndTime)
  } else {
    // Si no envían fin, usamos la duración estimada actual
    finalEndMin = finalStartMin + (targetAppt.estimated_duration_minutes || 60)
  }
  
  const finalEndTimeStr = formatTimeFromMinutes(finalEndMin)
  const newDuration = finalEndMin - finalStartMin

  // Re-aplicar integradad de negocio para timestamps si la cita ya estaba en operación
  const traceabilityUpdates = buildStatusTransitionUpdates(targetAppt, targetAppt.status)
  // Remover "status" ya que no lo vamos a cambiar, solo queremos los backfills de tiempo generados
  delete traceabilityUpdates.status

  // Preparar transacciones de actualización
  const updatesToApply: any[] = []

  updatesToApply.push({
    id: targetAppt.id,
    dock_id: finalDockId,
    scheduled_time: finalStartTimeStr,
    scheduled_end_time: finalEndTimeStr,
    estimated_duration_minutes: newDuration > 0 ? newDuration : (targetAppt.estimated_duration_minutes || 60),
    ...traceabilityUpdates
  })

  // 2. Obtener TODAS las citas posteriores en ese mismo muelle, ese mismo día
  // Esto es vital para calcular la cascada (Ripple Effect)
  const { data: subsequentAppts, error: subError } = await supabase
    .from("appointments")
    .select("id, scheduled_time, scheduled_end_time, estimated_duration_minutes, status")
    .eq("scheduled_date", targetAppt.scheduled_date)
    .eq("dock_id", finalDockId)
    .neq("id", targetAppt.id)
    .neq("status", "CANCELADO")
    .neq("status", "FINALIZADO")
    .order("scheduled_time", { ascending: true })

  if (subError) {
    return { success: false, error: "Error al validar secuencia del muelle." }
  }

  // 3. Evaluar e inyectar cascada (Bloques Snap de 15 min)
  const STEP_MIN = 15;
  const snapToNext = (min: number) => Math.ceil(min / STEP_MIN) * STEP_MIN;

  let currentBlockEnd = finalEndMin;

  for (const appt of (subsequentAppts || [])) {
    const apptStartMin = parseTime(appt.scheduled_time)
    const apptDuration = appt.estimated_duration_minutes || 60

    if (apptStartMin < currentBlockEnd) {
      // Conflicto detectado -> Desplazar en cascada manteniendo duración original
      const snappedStart = snapToNext(currentBlockEnd)
      const snappedEnd = snappedStart + apptDuration
      
      updatesToApply.push({
        id: appt.id,
        dock_id: finalDockId,
        scheduled_time: formatTimeFromMinutes(snappedStart) + ":00",
        scheduled_end_time: formatTimeFromMinutes(snappedEnd) + ":00",
        estimated_duration_minutes: apptDuration
      })
      
      currentBlockEnd = snappedEnd
    }
    // Si la cita subsecuente empieza DESPUÉS del fin del bloque actual, 
    // la cascada se detiene (ya no hay colisión física).
    // Nota: Como no podemos hacer un break porque podría haber una cita mal agendada en medio,
    // actualizamos el currentBlockEnd para que la siguiente validación sea precisa.
    else {
      const apptEndMin = appt.scheduled_end_time 
        ? parseTime(appt.scheduled_end_time) 
        : apptStartMin + apptDuration
      
      currentBlockEnd = Math.max(currentBlockEnd, apptEndMin)
    }
  }

  // 4. Aplicar updates a Supabase en lote (Promesa All para concurrencia)
  const updatePromises = updatesToApply.map(update => 
    supabase.from("appointments").update({
      dock_id: update.dock_id,
      scheduled_time: update.scheduled_time,
      scheduled_end_time: update.scheduled_end_time,
      estimated_duration_minutes: update.estimated_duration_minutes
    }).eq("id", update.id)
  )

  const results = await Promise.all(updatePromises)
  const hasErrors = results.some(r => r.error != null)

  if (hasErrors) {
    console.error("[shiftAndExtendAppointmentAction] Error en ejecución de cascada", results.map(r => r.error))
    return { success: false, error: "Fallo parcial en desplazamiento de citas de la cascada." }
  }

  return { success: true }
}

