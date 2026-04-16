import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "--"
  
  // If we receive a YYYY-MM-DD string, treat it as a local date (not UTC)
  // to avoid the "day before" issue in western timezones (like Colombia)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number)
    // month is 0-indexed in JS (January = 0)
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day))
  }

  // Fallback for other date/string formats
  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(date))
  } catch {
    return String(date)
  }
}

export function formatTime(time: string) {
  return time.slice(0, 5)
}

/**
 * Capitaliza la primera letra de una cadena y pone el resto en minúsculas.
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return ""
  const s = String(str).toLowerCase().trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Convierte una cadena a Title Case (capitaliza la primera letra de cada palabra).
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return ""
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Normaliza un objeto para almacenamiento en base de datos.
 * Convierte strings a minúsculas excepto claves críticas (Enums, IDs, passwords, etc).
 */
export function normalizeObjectForStorage<T>(
  data: T, 
  excludeKeys: string[] = [
    'password', 'notes', 'license_plate', 'license_plate_search', 'force_reason',
    'status', 'type', 'dock_type', 'priority_level', 'role', 'p_vehicle_type',
    'action', 'event_type', 'metadata', 'id'
  ]
): T {
  if (!data || typeof data !== 'object') return data

  const normalized = Array.isArray(data) ? [] : {} as any

  Object.keys(data as object).forEach((k) => {
    const value = (data as any)[k]

    // 1. Exclusión explícita por llave
    if (excludeKeys.includes(k) && typeof value === 'string') {
      // Caso especial para placas: siempre a MAYÚSCULAS
      if (k === 'license_plate' || k === 'license_plate_search') {
        normalized[k] = value.trim().toUpperCase()
      } 
      // Caso para Enums (que suelen ser UPPERCASE en DB)
      else if (k === 'type' || k === 'dock_type' || k === 'status') {
        normalized[k] = value.trim().toUpperCase()
      }
      else {
        normalized[k] = value // Mantener original
      }
    } 
    // 2. Normalización estándar para el resto de strings
    else if (typeof value === 'string') {
      normalized[k] = value.trim().toLowerCase()
    } 
    // 3. Recurrencia para objetos anidados
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[k] = normalizeObjectForStorage(value, excludeKeys)
    } 
    // 4. Mantener otros tipos (números, booleanos, arrays)
    else {
      normalized[k] = value
    }
  })

  return normalized as T
}
