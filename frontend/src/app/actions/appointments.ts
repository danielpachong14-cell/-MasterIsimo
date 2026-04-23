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

export async function recalculateTimelineCascade({
  appointmentId,
  newDockId,
  newStartTime,
  newEndTime,
  isAutomaticExtension = false
}: {
  appointmentId: string;
  newDockId?: number;
  newStartTime?: string;
  newEndTime?: string;
  isAutomaticExtension?: boolean;
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

  const traceabilityUpdates = buildStatusTransitionUpdates(targetAppt, targetAppt.status)
  delete traceabilityUpdates.status

  // Preparar transacciones de actualización y auditoría
  const updatesToApply: Record<string, unknown>[] = []
  const auditLogsToApply: Record<string, unknown>[] = []
  
  // UUID de correlación para el evento en cascada
  const triggerEventId = crypto.randomUUID()

  updatesToApply.push({
    id: targetAppt.id,
    dock_id: finalDockId,
    scheduled_time: finalStartTimeStr,
    scheduled_end_time: finalEndTimeStr,
    estimated_duration_minutes: newDuration > 0 ? newDuration : (targetAppt.estimated_duration_minutes || 60),
    ...traceabilityUpdates
  })

  auditLogsToApply.push({
    appointment_id: targetAppt.id,
    action: 'EDIT',
    changed_fields: {
      scheduled_time: { old: targetAppt.scheduled_time, new: finalStartTimeStr },
      scheduled_end_time: { old: targetAppt.scheduled_end_time, new: finalEndTimeStr },
      dock_id: { old: targetAppt.dock_id, new: finalDockId },
      trigger_event_id: triggerEventId
    },
    notes: isAutomaticExtension ? "Extensión automática +15m por demora en muelle." : "Reubicación/Edición manual de cita raíz."
  })

  // 2. Obtener TODAS las citas posteriores en ese mismo muelle, ese mismo día
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
      // Conflicto detectado -> Desplazar en cascada
      const snappedStart = snapToNext(currentBlockEnd)
      const snappedEnd = snappedStart + apptDuration
      
      const newTimeStr = formatTimeFromMinutes(snappedStart) + ":00"
      const newEndStr = formatTimeFromMinutes(snappedEnd) + ":00"

      updatesToApply.push({
        id: appt.id,
        dock_id: finalDockId,
        scheduled_time: newTimeStr,
        scheduled_end_time: newEndStr,
        estimated_duration_minutes: apptDuration
      })

      auditLogsToApply.push({
        appointment_id: appt.id,
        action: 'EDIT',
        changed_fields: {
          scheduled_time: { old: appt.scheduled_time, new: newTimeStr },
          scheduled_end_time: { old: appt.scheduled_end_time, new: newEndStr },
          trigger_event_id: triggerEventId
        },
        notes: "Reagendamiento en cascada por colisión de tiempos."
      })
      
      currentBlockEnd = snappedEnd
    } else {
      const apptEndMin = appt.scheduled_end_time 
        ? parseTime(appt.scheduled_end_time) 
        : apptStartMin + apptDuration
      
      currentBlockEnd = Math.max(currentBlockEnd, apptEndMin)
    }
  }

  // 4. Aplicar updates a Supabase en lote
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
    console.error("[recalculateTimelineCascade] Error en ejecución de cascada", results.map(r => r.error))
    return { success: false, error: "Fallo parcial en desplazamiento de citas de la cascada." }
  }

  // 5. Audit Log batch
  await supabase.from("appointment_audit_log").insert(auditLogsToApply)

  return { success: true }
}

export async function extendAppointmentAutomaticallyAction(appointmentId: string) {
  const supabase = await createClient()

  // Buscar cita para saber hora final y agregarle 15 minutos
  const { data: targetAppt, error: targetError } = await supabase
    .from("appointments")
    .select("id, scheduled_time, scheduled_end_time, estimated_duration_minutes")
    .eq("id", appointmentId)
    .single()

  if (targetError || !targetAppt) return { success: false }

  const endMin = targetAppt.scheduled_end_time 
    ? parseTime(targetAppt.scheduled_end_time) 
    : parseTime(targetAppt.scheduled_time) + (targetAppt.estimated_duration_minutes || 60)
  
  const newEndMin = endMin + 15
  const newEndTimeStr = formatTimeFromMinutes(newEndMin) + ":00"

  // Llamar al recalculador para que empuje lo demás y genere los logs
  return recalculateTimelineCascade({
    appointmentId,
    newEndTime: newEndTimeStr,
    isAutomaticExtension: true
  })
}

export async function assignFromWaitlistAction({
  appointmentId,
  dockId,
  date,
  startTime
}: {
  appointmentId: string;
  dockId: number;
  date: string;
  startTime: string;
}) {
  const supabase = await createClient()

  // Obtener la cita actual (EN_ESPERA)
  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("status, estimated_duration_minutes, environment_id, vehicle_type_id")
    .eq("id", appointmentId)
    .single()

  if (apptError || !appt) return { success: false, error: "Cita no encontrada." }
  if (appt.status !== 'EN_ESPERA') return { success: false, error: "La cita no está en espera." }


  // Delegar validación completa al assignDockAction (que utiliza checkDockAvailability)
  const result = await assignDockAction({
    appointmentId,
    dockId,
    scheduledDate: date,
    scheduledTime: startTime,
    newStatus: 'PENDIENTE',
    forceReason: "Reubicación desde Waitlist"
  })

  // Si fue exitosa, auditar que vino del waitlist
  if (result.success) {
    const triggerEventId = crypto.randomUUID()
    await supabase.from("appointment_audit_log").insert({
      appointment_id: appointmentId,
      action: 'STATUS_CHANGE',
      changed_fields: { status: { old: 'EN_ESPERA', new: 'PENDIENTE' }, trigger_event_id: triggerEventId },
      notes: `Reasignado manualmente al muelle ID ${dockId} a las ${startTime.substring(0,5)}`
    })
  }

  return result
}

/**
 * Avanza el estado operativo de una cita desde el Drawer.
 * Valida progresión lineal, aplica trazabilidad de timestamps y registra auditoría.
 * Reutiliza buildStatusTransitionUpdates para garantizar consistencia con el resto del sistema.
 */
export async function updateAppointmentStatusAction({
  appointmentId,
  newStatus
}: {
  appointmentId: string
  newStatus: AppointmentStatus
}) {
  const supabase = await createClient()

  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .select('id, status, arrival_time, docking_time, start_unloading_time, end_unloading_time')
    .eq('id', appointmentId)
    .single()

  if (apptError || !appt) {
    return { success: false, error: 'Cita no encontrada.' }
  }

  // Guard: previene regresión de estados (forward-only transitions)
  const STATUS_ORDER: AppointmentStatus[] = [
    'EN_ESPERA', 'PENDIENTE', 'EN_PORTERIA', 'EN_MUELLE', 'DESCARGANDO', 'FINALIZADO', 'CANCELADO'
  ]
  const currentIdx = STATUS_ORDER.indexOf(appt.status as AppointmentStatus)
  const newIdx = STATUS_ORDER.indexOf(newStatus)

  if (newIdx < currentIdx && newStatus !== 'CANCELADO') {
    return { success: false, error: `No se puede retroceder de "${appt.status}" a "${newStatus}".` }
  }

  const updates = buildStatusTransitionUpdates(appt, newStatus)

  const { error: updateError } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', appointmentId)

  if (updateError) {
    console.error('[updateAppointmentStatusAction] Error:', updateError)
    return { success: false, error: 'Error al actualizar el estado.' }
  }

  await supabase.from('appointment_audit_log').insert({
    appointment_id: appointmentId,
    action: 'STATUS_CHANGE',
    changed_fields: { status: { old: appt.status, new: newStatus } },
    notes: `Cambio de estado manual desde Drawer de Muelles: ${appt.status} → ${newStatus}`
  })

  return { success: true }
}
