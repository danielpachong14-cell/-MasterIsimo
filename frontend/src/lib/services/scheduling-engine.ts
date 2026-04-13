import { createClient } from "@/lib/supabase/client"
import { parseTime, formatTimeFromMinutes } from "./scheduling"
import type {
  CapacityCheckResult,
  AvailableSlot,
  SchedulingRule,
  DailyCapacityLimit,
  Dock,
  Appointment,
} from "@/types"

// ─── Paso 1: Validación de Capacidad Diaria (Soft Limits) ───

/**
 * Verifica la capacidad diaria para un ambiente en una fecha dada.
 * NUNCA bloquea la creación — solo retorna flags informativos.
 */
export async function checkDailyCapacity(
  date: string,
  environmentId: number,
  newBoxes: number
): Promise<CapacityCheckResult> {
  const supabase = createClient()

  // Obtener límite configurado para el ambiente
  const { data: limitRow, error: limitError } = await supabase
    .from("daily_capacity_limits")
    .select("*, environment:environments(*)")
    .eq("environment_id", environmentId)
    .eq("is_active", true)
    .single()

  if (limitError && limitError.code !== 'PGRST116') {
    console.error("Error fetching capacity limit:", limitError)
  }

  if (!limitRow) {
    // Sin límite configurado → permitir todo, sin alertas
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

  const currentBoxes = (existingAppointments || []).reduce((total: number, appt: any) => {
    const poBoxes = (appt as any).appointment_purchase_orders?.reduce(
      (s: number, po: { box_count: number }) => s + (po.box_count || 0),
      0
    ) || 0
    return total + (poBoxes || (appt as any).box_count || 0)
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
  environmentId: number,
  vehicleTypeId: number | null,
  categoryId: number | null,
  totalBoxes: number
): Promise<SchedulingRule | null> {
  const supabase = createClient()

  const { data: rules } = await supabase
    .from("scheduling_rules")
    .select("*")
    .eq("is_active", true)
    .eq("environment_id", environmentId)
    .lte("min_boxes", totalBoxes)
    .order("priority", { ascending: true })

  if (!rules || rules.length === 0) return null

  // Filtrar por max_boxes y compatibilidad de vehículo/categoría
  const matchingRules = rules.filter((rule) => {
    // Verificar rango de cajas
    if (rule.max_boxes !== null && totalBoxes > rule.max_boxes) return false

    // Verificar categoría: si la regla tiene categoría, debe coincidir
    if (rule.category_id !== null && rule.category_id !== categoryId) return false

    // Verificar vehículo: si la regla tiene vehículo, debe coincidir
    if (rule.vehicle_type_id !== null && rule.vehicle_type_id !== vehicleTypeId) return false

    return true
  })

  // Retornar la regla de mayor prioridad (menor número)
  return matchingRules[0] || null
}

// ─── Paso 3: Motor de Disponibilidad (Slotting) ─────────────

/**
 * Busca franjas horarias disponibles en muelles compatibles con el ambiente y vehículo.
 * Solo retorna slots donde hay un muelle individual con bloque completo libre.
 */
export async function findAvailableSlots(
  date: string,
  durationMinutes: number,
  environmentId: number,
  vehicleTypeId: number | null
): Promise<AvailableSlot[]> {
  const supabase = createClient()

  // 1. Obtener settings operativos
  const { data: settings, error: settingsError } = await supabase
    .from("cedi_settings")
    .select("*")
    .single()
  
  if (settingsError || !settings) {
    if (settingsError) console.error("Error fetching settings:", settingsError)
    return []
  }

  // 2. Obtener muelles compatibles con el ambiente
  const { data: allDocks, error: docksError } = await supabase
    .from("docks")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("id", { ascending: true })

  if (docksError || !allDocks || allDocks.length === 0) {
    if (docksError) console.error("Error fetching docks:", docksError)
    return []
  }

  // Filtrar muelles por ambiente
  const compatibleDocks = (allDocks as unknown as Dock[]).filter((dock) => {
    // Si el muelle no tiene ambiente asignado, es universal
    if (!dock.environment_id) return true
    // Match de ambiente
    if (dock.environment_id !== environmentId) return false
    // Verificar vehículo soportado (si está configurado)
    const svt = dock.supported_vehicle_types || []
    if (svt.length > 0 && vehicleTypeId && !svt.includes(vehicleTypeId)) return false
    return true
  })

  if (compatibleDocks.length === 0) return []

  // 3. Obtener citas activas para el día
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
  const { data: capacityLimit, error: capError } = await supabase
    .from("daily_capacity_limits")
    .select("*")
    .eq("environment_id", environmentId)
    .eq("is_active", true)
    .single()

  if (capError && capError.code !== 'PGRST116') {
    console.error("Error fetching capacity limit for slots:", capError)
  }

  const startMin = parseTime(settings.start_time)
  // Usar end_time normal del CEDI; el horario extendido expande el rango si aplica
  let endMin = parseTime(settings.end_time)

  // Si hay horario extendido configurado, ampliar el rango de búsqueda
  if (capacityLimit?.extended_end_time) {
    const extendedEnd = parseTime(capacityLimit.extended_end_time)
    if (extendedEnd > endMin) {
      endMin = extendedEnd
    }
  }

  const STEP_MINUTES = 30
  const slots: AvailableSlot[] = []

  // 5. Iterar sobre el horario buscando huecos
  for (let t = startMin; t <= endMin - durationMinutes; t += STEP_MINUTES) {
    const proposedStart = t
    const proposedEnd = t + durationMinutes

    // Buscar el primer muelle compatible que tenga el bloque libre
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

// ─── Orquestador Principal ──────────────────────────────────

export interface SchedulingRequest {
  date: string
  environmentId: number
  vehicleTypeId: number | null
  categoryId: number | null
  totalBoxes: number
}

export interface SchedulingResult {
  capacity: CapacityCheckResult
  rule: SchedulingRule | null
  durationMinutes: number
  slots: AvailableSlot[]
}

/**
 * Ejecuta el motor completo de scheduling en cascada.
 * Paso 1: Valida capacidad → Paso 2: Calcula duración → Paso 3: Busca slots.
 */
export async function runSchedulingEngine(
  request: SchedulingRequest
): Promise<SchedulingResult> {
  // Paso 1: Capacidad
  const capacity = await checkDailyCapacity(
    request.date,
    request.environmentId,
    request.totalBoxes
  )

  // Paso 2: Regla de duración
  const rule = await resolveSchedulingRule(
    request.environmentId,
    request.vehicleTypeId,
    request.categoryId,
    request.totalBoxes
  )

  const durationMinutes = rule?.duration_minutes || 60 // Fallback: 1h

  // Paso 3: Slots disponibles
  const slots = await findAvailableSlots(
    request.date,
    durationMinutes,
    request.environmentId,
    request.vehicleTypeId
  )

  return { capacity, rule, durationMinutes, slots }
}
