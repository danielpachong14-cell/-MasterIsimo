import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppointmentStatus } from "@/types"

/**
 * Proyección granular de Appointment para el tablero Kanban.
 * Solo incluye los campos estrictamente necesarios para renderizar las tarjetas
 * y ejecutar las transiciones de estado — reduciendo el payload ~80% vs. select(*).
 */
export interface KanbanAppointmentRow {
  id: string
  status: AppointmentStatus
  license_plate: string
  company_name: string
  dock_id: number | null
  dock_name?: string | null
  scheduled_time: string
  estimated_duration_minutes: number | null
  arrival_time: string | null
  docking_time: string | null
  start_unloading_time: string | null
  end_unloading_time: string | null
  punctuality_status: string | null
  force_reason: string | null
  is_walk_in: boolean | null
  is_express: boolean | null
  appointment_purchase_orders: {
    id: string
    po_number: string
    box_count: number
  }[]
}

/**
 * Proyección granular de Appointment para la línea de tiempo de Muelles.
 * Solo incluye los campos necesarios para renderizar bloques de tiempo
 * y gestionar colisiones de muelle.
 */
export interface TimelineAppointmentRow {
  id: string
  dock_id: number | null
  scheduled_time: string
  scheduled_end_time: string | null
  estimated_duration_minutes: number | null
  status: AppointmentStatus
  license_plate: string
  company_name: string
  driver_name: string
  box_count: number | null
  appointment_purchase_orders: {
    box_count: number
  }[]
}

/**
 * Proyección granular de Dock para la vista de Timeline.
 */
export interface TimelineDockRow {
  id: number
  name: string
  is_active: boolean
  type: 'DESCARGUE' | 'CARGUE' | 'MIXTO'
  is_unloading_authorized: boolean
  priority: number | null
  environment_id: number | null
}

// ─── Selects granulares (strings constantes para reutilización) ───────────────

/** Campos mínimos para el tablero Kanban */
const KANBAN_SELECT = `
  id,
  status,
  license_plate,
  company_name,
  dock_id,
  scheduled_time,
  estimated_duration_minutes,
  arrival_time,
  docking_time,
  start_unloading_time,
  end_unloading_time,
  punctuality_status,
  force_reason,
  is_walk_in,
  is_express,
  docks(name),
  appointment_purchase_orders(id, po_number, box_count)
`.trim()

/** Campos mínimos para la línea de tiempo de muelles */
const TIMELINE_SELECT = `
  id,
  dock_id,
  scheduled_time,
  scheduled_end_time,
  estimated_duration_minutes,
  status,
  license_plate,
  company_name,
  driver_name,
  box_count,
  appointment_purchase_orders(box_count)
`.trim()

/** Campos mínimos para muelles en la vista de timeline */
const TIMELINE_DOCK_SELECT = "id, name, is_active, type, is_unloading_authorized, priority, environment_id"

/** Campos para el modal de detalles de cita */
const DETAILS_SELECT = `
  id,
  appointment_number,
  status,
  license_plate,
  company_name,
  driver_name,
  driver_phone,
  driver_id_card,
  dock_id,
  scheduled_date,
  scheduled_time,
  scheduled_end_time,
  estimated_duration_minutes,
  arrival_time,
  docking_time,
  start_unloading_time,
  end_unloading_time,
  punctuality_status,
  force_reason,
  is_walk_in,
  is_express,
  notes,
  boxes_received,
  damages,
  unloading_personnel,
  docks(name),
  appointment_purchase_orders(id, po_number, box_count)
`.trim()

// ─── Funciones del servicio ───────────────────────────────────────────────────

/**
 * Obtiene las citas activas para el tablero Kanban (estados pre-finalización).
 * Excluye CANCELADO y FINALIZADO para mantener el board limpio.
 * Si se proporciona date, filtra estrictamente por ese día (recomendado para performance).
 */
export async function fetchKanbanAppointments(
  supabase: SupabaseClient,
  date?: string
): Promise<KanbanAppointmentRow[]> {
  let query = supabase
    .from("appointments")
    .select(KANBAN_SELECT)
    .in("status", ["PENDIENTE", "EN_PORTERIA", "EN_MUELLE", "DESCARGANDO"])

  if (date) {
    query = query.eq("scheduled_date", date)
  }

  const { data, error } = await query.order("created_at", { ascending: true })

  if (error) {
    console.error("[AppointmentsService] Error fetching kanban appointments:", error)
    return []
  }

  // Aplanar el resultado relacional de docks(name) -> dock_name (Robusto ante objeto o array)
  const rows = data as unknown as (Record<string, unknown> & { docks?: { name: string } | { name: string }[] })[]
  
  return (rows ?? []).map((row) => {
    const rawDock = row.docks
    const dockName = Array.isArray(rawDock) 
      ? rawDock[0]?.name 
      : (rawDock as { name: string })?.name

    return {
      ...row,
      dock_name: dockName || null,
      docks: undefined // Limpiar el objeto anidado
    }
  }) as unknown as KanbanAppointmentRow[]
}

/**
 * Obtiene el detalle completo de una cita por su ID.
 * Utilizado por el Modal de Detalles para asegurar reactividad y datos frescos.
 */
export async function fetchAppointmentById(
  supabase: SupabaseClient,
  id: string
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(DETAILS_SELECT)
    .eq("id", id)
    .single()

  if (error || !data) {
    console.error(`[AppointmentsService] Error fetching appointment ${id}:`, error)
    return null
  }

  // Aplanar resultado: Extraemos docks y devolvemos el resto con dock_name al primer nivel
  const row = data as unknown as (Record<string, unknown> & { docks?: { name: string } | { name: string }[] })
  const { docks, ...baseData } = row
  const dockName = Array.isArray(docks) 
    ? docks[0]?.name 
    : (docks as { name: string })?.name

  return {
    ...baseData,
    dock_name: dockName || null
  }
}

/**
 * Obtiene las citas de un día específico para la línea de tiempo de muelles.
 * Incluye todos los estados excepto CANCELADO para mostrar el historial del día.
 */
export async function fetchTimelineAppointments(
  supabase: SupabaseClient,
  date: string
): Promise<TimelineAppointmentRow[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(TIMELINE_SELECT)
    .eq("scheduled_date", date)
    .neq("status", "CANCELADO")
    .order("scheduled_time")

  if (error) {
    console.error("[AppointmentsService] Error fetching timeline appointments:", error)
    return []
  }

  return (data ?? []) as unknown as TimelineAppointmentRow[]
}

/**
 * Obtiene los muelles activos que permiten operaciones de descarga.
 * Filtra CARGUE puro; incluye DESCARGUE y MIXTO con autorización.
 */
export async function fetchTimelineDocks(
  supabase: SupabaseClient
): Promise<TimelineDockRow[]> {
  const { data, error } = await supabase
    .from("docks")
    .select(TIMELINE_DOCK_SELECT)
    .eq("is_active", true)
    .or("type.eq.DESCARGUE,and(type.eq.MIXTO,is_unloading_authorized.eq.true)")
    .order("priority")
    .order("id")

  if (error) {
    console.error("[AppointmentsService] Error fetching timeline docks:", error)
    return []
  }

  return (data ?? []) as unknown as TimelineDockRow[]
}

/**
 * Updates de estado con timestamps de trazabilidad automáticos.
 * Centraliza la lógica de transición para que no se duplique en Kanban y Trazabilidad.
 *
 * @returns El objeto de updates aplicado, para optimistic update en el cliente.
 */
export function buildStatusTransitionUpdates(
  currentRecord: { status: AppointmentStatus; arrival_time?: string | null; docking_time?: string | null; start_unloading_time?: string | null; end_unloading_time?: string | null },
  newStatus: AppointmentStatus
): Record<string, unknown> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status: newStatus }

  // Auto-timestamps de trazabilidad (Backfill en cascada)
  if (newStatus === "FINALIZADO") {
    if (!currentRecord.end_unloading_time) updates.end_unloading_time = now
    if (!currentRecord.start_unloading_time) updates.start_unloading_time = now
    if (!currentRecord.docking_time) updates.docking_time = now
    if (!currentRecord.arrival_time) updates.arrival_time = now
  } else if (newStatus === "DESCARGANDO") {
    if (!currentRecord.start_unloading_time) updates.start_unloading_time = now
    if (!currentRecord.docking_time) updates.docking_time = now
    if (!currentRecord.arrival_time) updates.arrival_time = now
  } else if (newStatus === "EN_MUELLE") {
    if (!currentRecord.docking_time) updates.docking_time = now
    if (!currentRecord.arrival_time) updates.arrival_time = now
  } else if (newStatus === "EN_PORTERIA") {
    if (!currentRecord.arrival_time) updates.arrival_time = now
  }

  return updates
}
