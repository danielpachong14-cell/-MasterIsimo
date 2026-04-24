export type AppointmentStatus = 'PENDIENTE' | 'EN_PORTERIA' | 'EN_MUELLE' | 'DESCARGANDO' | 'FINALIZADO' | 'CANCELADO' | 'EN_ESPERA' | 'INCUMPLIDA';

export interface AppointmentPurchaseOrder {
  id: string;
  appointment_id: string;
  po_number: string;
  box_count: number;
  created_at?: string;
}

export interface Appointment {
  id: string;
  po_number?: string | null;
  company_name: string;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_end_time?: string | null;
  estimated_duration_minutes?: number | null;
  box_count?: number | null;
  vehicle_type: string;
  vehicle_type_id?: number | null;
  license_plate: string;
  driver_name: string;
  driver_phone: string;
  status: AppointmentStatus;
  dock_id: number | null;
  dock_name?: string | null;
  is_walk_in?: boolean | null;
  is_express?: boolean | null;
  environment_id?: number | null;
  environment_name?: string | null;
  environment_color?: string | null;

  is_forced_assignment?: boolean | null;
  force_reason?: string | null;
  requires_extended_hours?: boolean | null;
  scheduling_rule_id?: number | null;
  created_at: string;
  updated_at: string;
  appointment_purchase_orders?: AppointmentPurchaseOrder[];
  // Auto Check-in & KPI tracking
  appointment_number?: string | null;
  arrival_time?: string | null;
  docking_time?: string | null;
  punctuality_status?: string | null;
  driver_id_card?: string | null;
  start_unloading_time?: string | null;
  end_unloading_time?: string | null;
  boxes_received?: number | null;
  damages?: number | null;
  comments?: string | null;
  unloading_personnel?: number | null;
  notes?: string | null;
}

export interface AppointmentFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: AppointmentStatus | null;
  licensePlate?: string | null;
  companyName?: string | null;
  isWalkIn?: boolean | null;
}

export interface SchedulingRequest {
  date: string
  environmentId?: number | null
  vehicleTypeId: number | null
  totalBoxes: number
}

export interface PaginatedResult<T> {
  data: T[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AppointmentAuditLog {
  id: string;
  appointment_id: string;
  user_id?: string | null;
  action: 'CREATE' | 'EDIT' | 'CANCEL' | 'STATUS_CHANGE' | 'WALK_IN';
  changed_fields?: Record<string, unknown>;
  notes?: string | null;
  created_at: string;
}

export interface VehicleType {
  id: number;
  name: string;
  base_boxes: number;
  base_time_minutes: number;
  maneuver_time_minutes: number;
  is_active: boolean;
  created_at?: string;
}

export interface Dock {
  id: number;
  name: string;
  is_active: boolean;
  type: 'DESCARGUE' | 'CARGUE' | 'MIXTO';
  is_unloading_authorized: boolean;
  description?: string;
  supported_cargo_types?: string[];
  max_vehicle_length_m?: number | null;
  priority?: number;
  environment_id?: number | null;
  environment?: Environment;
  supported_vehicle_types?: number[];
  created_at?: string;
}

export interface CediSettings {
  id: number;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role_id: number;
  role_name?: string;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  created_at: string;
  last_accessed_at?: string;
  last_sign_in_at: string;
  ip_address: string;
  user_agent: string;
  is_current: boolean;
}

// ─── Scheduling Engine Domain ────────────────────────────────

export interface Environment {
  id: number;
  name: string;
  display_name: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at?: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  display_name: string;
  is_active: boolean;
  created_at?: string;
}

export interface DailyCapacityLimit {
  id: number;
  environment_id: number;
  environment?: Environment;
  normal_box_limit: number;
  extended_box_limit: number;
  extended_start_time?: string | null;
  extended_end_time?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface SchedulingRule {
  id: number;
  name: string;
  environment_id?: number | null;
  environment?: Environment;
  vehicle_type_id?: number | null;
  vehicle_type?: VehicleType;
  min_boxes: number;
  max_boxes?: number | null;
  duration_minutes: number;
  max_duration_minutes?: number | null;
  is_dynamic: boolean;
  efficiency_multiplier: number;
  docks_required: number;
  priority: number;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface CapacityCheckResult {
  withinNormal: boolean;
  withinExtended: boolean;
  currentBoxes: number;
  normalLimit: number;
  extendedLimit: number;
  overCapacity: boolean;
  requiresExtendedHours: boolean;
}

export interface AvailableSlot {
  time: string;
  dock_id: number;
  dock_name: string;
  environment_name?: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

// Removed duplicated UserSession - now unified above

// ─── EOD (End-of-Day) Summary ────────────────────────────────

/**
 * Shape del JSON retornado por la función SQL get_daily_summary(p_date).
 * Tipado estricto para la Server Action fetchDailySummaryAction.
 */
export interface DailySummary {
  date: string
  // Conteos por estado
  total: number
  completed: number
  no_show: number
  cancelled: number
  pending: number
  waiting: number
  in_gate: number
  at_dock: number
  unloading: number
  // Balance de carga (cajas)
  boxes_projected: number
  boxes_received: number
  boxes_missing: number
  // Nivel de servicio (0–100)
  service_level_pct: number
  // Tiempos promedio en minutos (null si no hay datos suficientes)
  avg_wait_patio_min: number | null
  avg_wait_dock_min: number | null
  avg_unloading_min: number | null
}

// ─── Service-Layer Projections ───────────────────────────────
// Para queries granulares (Kanban, Timeline de Muelles, etc.), ver:
// → @/lib/services/appointments (KanbanAppointmentRow, TimelineAppointmentRow, TimelineDockRow)
// Estos tipos son subconjuntos de Appointment y Dock definidos por el servicio de datos
// para garantizar cero over-fetching en las vistas operativas.
