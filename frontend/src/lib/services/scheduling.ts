// Las funciones puras de conversión de tiempo no tienen dependencias externas.
// getAvailableSlots (legacy) fue reemplazada por findAvailableSlots en scheduling-engine.ts,
// que opera con el cliente de servidor (DI) y soporta filtrado por ambiente y vehículo.

/**
 * Resultado de los cálculos de tiempo del motor.
 * @property realMinutes - Tiempo exacto de operación estimado para el CEDI.
 * @property bufferMinutes - Tiempo con margen de seguridad del 50% para comunicación con el transportador.
 */
export interface CalculationResult {
  realMinutes: number;
  bufferMinutes: number;
}

/**
 * Calcula la duración estimada de una descarga en minutos.
 * Utiliza la fórmula biomecánica: (Cajas Totales / Eficiencia Base) * Tiempo Base + Maniobra.
 *
 * @param totalBoxes - Cantidad de cajas reportada por el proveedor.
 * @param baseBoxes - Capacidad estándar de cajas para el tipo de vehículo.
 * @param baseTimeMins - Tiempo promedio de descarga de la capacidad base.
 * @param maneuverTimeMins - Tiempo de gracia para entrada y posicionamiento en muelle.
 * @returns Un objeto con el tiempo real para operación y el tiempo con buffer para el transportador.
 */
export function calculateDuration(
  totalBoxes: number,
  baseBoxes: number,
  baseTimeMins: number,
  maneuverTimeMins: number
): CalculationResult {
  if (baseBoxes === 0) return { realMinutes: 0, bufferMinutes: 0 }

  // Cálculo lineal del tiempo de descarga
  const calculatedMins = (totalBoxes / baseBoxes) * baseTimeMins
  const realMinutes = Math.ceil(calculatedMins) + maneuverTimeMins

  // Margen del 50% extra para mitigar la percepción de retraso y gestionar colas.
  const bufferMinutes = Math.ceil(realMinutes * 1.5)

  return { realMinutes, bufferMinutes }
}

/**
 * Convierte un string de tiempo (HH:MM o HH:MM:SS) a minutos absolutos desde las 00:00.
 */
export function parseTime(timeString: string): number {
  if (!timeString) return 0
  
  if (timeString.includes('T')) {
    const date = new Date(timeString)
    return date.getHours() * 60 + date.getMinutes()
  }

  const parts = timeString.split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}

/**
 * Convierte minutos absolutos a formato de reloj HH:MM legible por humanos.
 */
export function formatTimeFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
