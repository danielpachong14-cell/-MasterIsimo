import type { SupabaseClient } from "@supabase/supabase-js"
import { parseTime, formatTimeFromMinutes, calculateDuration } from "./scheduling"
export { parseTime, formatTimeFromMinutes, calculateDuration }
import type {
  CapacityCheckResult,
  AvailableSlot,
  SchedulingRule,
  Dock,
} from "@/types"

// ─── Selects granulares (strings constantes para reutilización) ───────────────

const CAPACITY_LIMIT_SELECT = "id, environment_id, normal_box_limit, extended_box_limit, extended_end_time, is_active"

const SCHEDULING_RULE_SELECT = "id, environment_id, vehicle_type_id, min_boxes, max_boxes, duration_minutes, max_duration_minutes, efficiency_multiplier, is_dynamic, priority, is_active"

// ─── Paso 1: Validación de Capacidad Diaria (Soft Limits) ───

/**
 * Verifica la capacidad diaria para un ambiente en una fecha dada.
 *
 * Recibe el cliente de Supabase como parámetro para garantizar que este motor
 * SIEMPRE se ejecute en el servidor (Server Action / Route Handler), nunca
 * exponiendo lógica de negocio al navegador.
 *
 * NUNCA bloquea la creación — solo retorna flags informativos.
 */
export async function checkDailyCapacity(
  supabase: SupabaseClient,
  date: string,
  environmentId: number | null,
  newBoxes: number
): Promise<CapacityCheckResult> {
  // Obtener límite configurado para el ambiente
  const { data: limitRow, error: limitError } = await supabase
    .from("daily_capacity_limits")
    .select(`${CAPACITY_LIMIT_SELECT}, environment:environments(id, name)`)
    .eq("environment_id", environmentId)
    .eq("is_active", true)
    .single()

  if (limitError && limitError.code !== 'PGRST116') {
    console.error("Error fetching capacity limit:", limitError)
  }

  if (!limitRow || !environmentId) {
    // Sin límite configurado o sin ambiente → permitir todo, sin alertas
    return {
      withinNormal: true,
      withinExtended: true,
      currentBoxes: 0,
      normalLimit: Infinity,
      extendedLimit: Infinity,
      overCapacity: false,
      requiresExtendedHours: false,
    }
  }

  // Sumar cajas ya agendadas para ese día y ambiente
  const { data: existingAppointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id, box_count, appointment_purchase_orders(box_count)")
    .eq("scheduled_date", date)
    .eq("environment_id", environmentId)
    .neq("status", "CANCELADO")

  if (appointmentsError) {
    console.error("Error fetching existing appointments for capacity:", appointmentsError)
  }

  const currentBoxes = (existingAppointments || []).reduce((total: number, appt: { box_count?: number, appointment_purchase_orders?: { box_count: number }[] }) => {
    const poBoxes = appt.appointment_purchase_orders?.reduce(
      (s: number, po: { box_count: number }) => s + (po.box_count || 0),
      0
    ) || 0
    return total + (poBoxes || appt.box_count || 0)
  }, 0)

  const projectedTotal = currentBoxes + newBoxes

  return {
    currentBoxes,
    normalLimit: limitRow.normal_box_limit,
    extendedLimit: limitRow.extended_box_limit,
    withinNormal: projectedTotal <= limitRow.normal_box_limit,
    withinExtended: projectedTotal <= limitRow.extended_box_limit,
    overCapacity: projectedTotal > limitRow.extended_box_limit,
    requiresExtendedHours: projectedTotal > limitRow.normal_box_limit && projectedTotal <= limitRow.extended_box_limit,
  }
}

// ─── Paso 2: Resolución de Regla de Scheduling ──────────────

/**
 * Busca la regla de scheduling más específica que aplique al cruce dado.
 * Evalúa en orden de prioridad (menor número = mayor prioridad).
 *
 * Cascada de resolución:
 * 1. Match exacto: ambiente + vehículo + categoría + rango cajas
 * 2. Match parcial: ambiente + categoría (vehículo NULL)
 * 3. Match parcial: ambiente + vehículo (categoría NULL)
 * 4. Match genérico: solo ambiente + rango cajas
 */
export async function resolveSchedulingRule(
  supabase: SupabaseClient,
  environmentId: number | null,
  vehicleTypeId: number | null,
  totalBoxes: number
): Promise<SchedulingRule | null> {
  let query = supabase
    .from("scheduling_rules")
    .select(SCHEDULING_RULE_SELECT)
    .eq("is_active", true)
    .lte("min_boxes", totalBoxes)
    .order("priority", { ascending: true })

  if (environmentId) {
    query = query.eq("environment_id", environmentId)
  }

  const { data: rules } = await query

  if (!rules || rules.length === 0) return null

  // Filtrar por max_boxes y compatibilidad de vehículo (sin categoría).
  // La cascada resuelve ahora exclusivamente por: ambiente → vehículo → rango de cajas.
  const matchingRules = (rules as unknown as SchedulingRule[]).filter((rule) => {
    if (rule.max_boxes != null && totalBoxes > rule.max_boxes) return false
    if (rule.vehicle_type_id != null && rule.vehicle_type_id !== vehicleTypeId) return false
    return true
  })

  // Retornar la regla de mayor prioridad
  return matchingRules[0] || null
}

// ─── Paso 3: Motor de Disponibilidad (Slotting) ─────────────

/**
 * Busca franjas horarias disponibles en muelles compatibles con el ambiente y vehículo.
 * Solo retorna slots donde hay un muelle individual con bloque completo libre.
 */
export async function findAvailableSlots(
  supabase: SupabaseClient,
  date: string,
  durationMinutes: number,
  environmentId: number | null,
  vehicleTypeId: number | null
): Promise<AvailableSlot[]> {
  // 1. Obtener settings operativos
  const { data: settings, error: settingsError } = await supabase
    .from("cedi_settings")
    .select("start_time, end_time")
    .single()

  if (settingsError || !settings) {
    if (settingsError) console.error("Error fetching settings:", settingsError)
    return []
  }

  // 2. Obtener muelles activos
  const { data: allDocks, error: docksError } = await supabase
    .from("docks")
    .select("id, name, environment_id, supported_vehicle_types, type, is_unloading_authorized, priority, is_active")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("id", { ascending: true })

  if (docksError || !allDocks || allDocks.length === 0) {
    if (docksError) console.error("Error fetching docks:", docksError)
    return []
  }

  // Filtrar muelles por ambiente y disponibilidad operativa para DESCARGA
  const compatibleDocks = (allDocks as unknown as Dock[]).filter((dock) => {
    if (dock.type === 'CARGUE') return false
    if (dock.type === 'MIXTO' && !dock.is_unloading_authorized) return false
    if (!dock.environment_id) return true
    if (environmentId && dock.environment_id && dock.environment_id !== environmentId) return false
    const svt = dock.supported_vehicle_types || []
    if (svt.length > 0 && vehicleTypeId && !svt.includes(vehicleTypeId)) return false
    return true
  })

  if (compatibleDocks.length === 0) return []

  // 3. Obtener citas activas para el día (solo campos para colisión)
  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select("scheduled_time, estimated_duration_minutes, scheduled_end_time, dock_id")
    .eq("scheduled_date", date)
    .neq("status", "CANCELADO")

  if (apptError) {
    console.error("Error fetching appointments for slots:", apptError)
  }

  const bookedBlocks = (appointments || []).map((app) => ({
    dockId: app.dock_id,
    start: parseTime(app.scheduled_time),
    end: app.scheduled_end_time
      ? parseTime(app.scheduled_end_time)
      : parseTime(app.scheduled_time) + (app.estimated_duration_minutes || 0),
  }))

  // 4. Verificar capacidad extendida para decidir el rango de búsqueda
  let capacityLimit = null
  if (environmentId) {
    const { data: capLimit, error: capError } = await supabase
      .from("daily_capacity_limits")
      .select(CAPACITY_LIMIT_SELECT)
      .eq("environment_id", environmentId)
      .eq("is_active", true)
      .single()
    capacityLimit = capLimit

    if (capError && capError.code !== 'PGRST116') {
      console.error("Error fetching capacity limit for slots:", capError)
    }
  }

  const startMin = parseTime(settings.start_time)
  let endMin = parseTime(settings.end_time)

  if (capacityLimit?.extended_end_time) {
    const extendedEnd = parseTime(capacityLimit.extended_end_time)
    if (extendedEnd > endMin) {
      endMin = extendedEnd
    }
  }

  const STEP_MINUTES = 30
  const slots: AvailableSlot[] = []

  for (let t = startMin; t <= endMin - durationMinutes; t += STEP_MINUTES) {
    const proposedStart = t
    const proposedEnd = t + durationMinutes

    const availableDock = compatibleDocks.find((dock) => {
      const hasConflict = bookedBlocks.some(
        (block) =>
          block.dockId === dock.id &&
          block.start < proposedEnd &&
          block.end > proposedStart
      )
      return !hasConflict
    })

    if (availableDock) {
      slots.push({
        time: formatTimeFromMinutes(proposedStart),
        dock_id: availableDock.id,
        dock_name: availableDock.name,
      })
    }
  }

  return slots
}

/**
 * Verifica si un muelle específico está disponible en un bloque de tiempo dado.
 * Utilizado por acciones de asignación manual para garantizar la integridad.
 */
export async function checkDockAvailability(
  supabase: SupabaseClient,
  dockId: number,
  date: string,
  startTimeMinutes: number,
  durationMinutes: number,
  excludeAppointmentId?: string
): Promise<{ available: boolean; conflictWith?: string }> {
  const proposedEnd = startTimeMinutes + durationMinutes

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, scheduled_time, estimated_duration_minutes, scheduled_end_time, license_plate")
    .eq("scheduled_date", date)
    .eq("dock_id", dockId)
    .neq("status", "CANCELADO")

  if (error) {
    console.error("Error checking dock availability:", error)
    return { available: false }
  }

  let conflictLabel: string | undefined

  const hasConflict = (appointments || []).some((app) => {
    if (excludeAppointmentId && app.id === excludeAppointmentId) return false

    const start = parseTime(app.scheduled_time)
    const end = app.scheduled_end_time
      ? parseTime(app.scheduled_end_time)
      : start + (app.estimated_duration_minutes || 0)

    const overlap = start < proposedEnd && end > startTimeMinutes
    if (overlap) conflictLabel = app.license_plate
    return overlap
  })

  return { 
    available: !hasConflict, 
    conflictWith: conflictLabel 
  }
}

// ─── Orquestador Principal ──────────────────────────────────

export interface SchedulingRequest {
  date: string
  environmentId: number | null
  vehicleTypeId: number | null
  totalBoxes: number
}

export interface SchedulingResult {
  capacity: CapacityCheckResult
  rule: SchedulingRule | null
  durationMinutes: number
  slots: AvailableSlot[]
  calculationSource?: 'RULE' | 'VEHICLE_FALLBACK' | 'DEFAULT'
}

/**
 * Ejecuta el motor completo de scheduling en cascada.
 * Paso 1: Valida capacidad → Paso 2: Calcula duración → Paso 3: Busca slots.
 *
 * Debe invocarse exclusivamente desde un Server Action o Route Handler,
 * pasando el cliente de Supabase del servidor (lib/supabase/server.ts).
 */
export async function runSchedulingEngine(
  supabase: SupabaseClient,
  request: SchedulingRequest
): Promise<SchedulingResult> {
  // Paso 1: Capacidad
  const capacity = await checkDailyCapacity(
    supabase,
    request.date,
    request.environmentId,
    request.totalBoxes
  )

  const rule = await resolveSchedulingRule(
    supabase,
    request.environmentId,
    request.vehicleTypeId,
    request.totalBoxes
  )

  let durationMinutes = 60 // Fallback base
  let calculationSource: 'RULE' | 'VEHICLE_FALLBACK' | 'DEFAULT' = 'DEFAULT'

  if (rule) {
    if (rule.is_dynamic) {
      if (rule.max_duration_minutes && rule.max_boxes && rule.max_boxes > rule.min_boxes) {
        // Interpolación Lineal (LERP) por Rango
        const deltaBoxes = rule.max_boxes - rule.min_boxes
        const deltaTime = rule.max_duration_minutes - rule.duration_minutes
        const extraBoxes = Math.max(0, request.totalBoxes - rule.min_boxes)
        const interpolatedExtra = (extraBoxes * deltaTime) / deltaBoxes
        durationMinutes = Math.ceil(rule.duration_minutes + interpolatedExtra)
        calculationSource = 'RULE'
      } else if (request.vehicleTypeId) {
        // Cálculo por eficiencia de vehículo + multiplicador
        const { data: vehicle } = await supabase
          .from("vehicle_types")
          .select("base_boxes, base_time_minutes, maneuver_time_minutes")
          .eq("id", request.vehicleTypeId)
          .single()

        if (vehicle) {
          const { realMinutes } = calculateDuration(
            request.totalBoxes,
            vehicle.base_boxes,
            vehicle.base_time_minutes * (rule.efficiency_multiplier || 1),
            vehicle.maneuver_time_minutes
          )
          durationMinutes = realMinutes
          calculationSource = 'RULE'
        } else {
          durationMinutes = rule.duration_minutes
          calculationSource = 'RULE'
        }
      } else {
        durationMinutes = rule.duration_minutes
        calculationSource = 'RULE'
      }
    } else {
      // Tiempo fijo de la regla
      durationMinutes = rule.duration_minutes
      calculationSource = 'RULE'
    }
  } else if (request.vehicleTypeId) {
    // Fallback: Si no hay regla, usar cálculo estándar del vehículo
    const { data: vehicle } = await supabase
      .from("vehicle_types")
      .select("base_boxes, base_time_minutes, maneuver_time_minutes")
      .eq("id", request.vehicleTypeId)
      .single()

    if (vehicle) {
      const { realMinutes } = calculateDuration(
        request.totalBoxes,
        vehicle.base_boxes,
        vehicle.base_time_minutes,
        vehicle.maneuver_time_minutes
      )
      durationMinutes = realMinutes
      calculationSource = 'VEHICLE_FALLBACK'
    }
  }

  // Paso 3: Slots disponibles
  const slots = await findAvailableSlots(
    supabase,
    request.date,
    durationMinutes,
    request.environmentId,
    request.vehicleTypeId
  )

  return { capacity, rule, durationMinutes, slots, calculationSource }
}
