export type AppointmentStatus = 'PENDIENTE' | 'EN_PORTERIA' | 'EN_PATIO' | 'EN_MUELLE' | 'DESCARGANDO' | 'FINALIZADO' | 'CANCELADO';

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
  dock_name?: string;
  is_walk_in?: boolean;
  environment_id?: number | null;
  category_id?: number | null;
  is_forced_assignment?: boolean;
  force_reason?: string | null;
  requires_extended_hours?: boolean;
  scheduling_rule_id?: number | null;
  created_at: string;
  updated_at: string;
  appointment_purchase_orders?: AppointmentPurchaseOrder[];
  // Auto Check-in & KPI tracking
  appointment_number?: string | null;
  arrival_time?: string | null;
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
  category_id?: number | null;
  category?: ProductCategory;
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
