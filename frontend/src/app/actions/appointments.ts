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
  let rawTime = scheduledTime || appointment.scheduled_time || "00:00:00"
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
  let updates: any = {
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
