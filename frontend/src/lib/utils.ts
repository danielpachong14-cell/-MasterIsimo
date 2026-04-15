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
  } catch (e) {
    return String(date)
  }
}

export function formatTime(time: string) {
  return time.slice(0, 5)
}
