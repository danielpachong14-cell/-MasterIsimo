import { createClient } from "@/lib/supabase/client"

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
  const calculatedMins = (totalBoxes / baseBoxes) * baseTimeMins;
  const realMinutes = Math.ceil(calculatedMins) + maneuverTimeMins;
  
  // Margen del 50% extra para mitigar la percepción de retraso y gestionar colas.
  const bufferMinutes = Math.ceil(realMinutes * 1.5);
  
  return { realMinutes, bufferMinutes };
}

/**
 * Busca franjas horarias donde al menos un muelle individual tiene un bloque
 * completo de tiempo libre para la duración requerida.
 * 
 * Realiza verificación per-dock en lugar de solo contar concurrencia global,
 * garantizando que cada slot retornado tiene un muelle físico asignable.
 * 
 * @param date - Fecha de consulta en formato YYYY-MM-DD.
 * @param requiredRealMinutes - Duración en minutos que ocupará el camión en el muelle.
 * @returns Array de strings con las horas disponibles en formato HH:MM.
 */
export async function getAvailableSlots(date: string, requiredRealMinutes: number): Promise<string[]> {
  const supabase = createClient()
  
  // 1. Obtener la parametrización operativa del CEDI
  const { data: settings } = await supabase.from('cedi_settings').select('*').single()
  if (!settings) return []
  
  // 2. Obtener muelles ACTIVOS y que permitan DESCARGA (o mixtos autorizados)
  const { data: docks } = await supabase
    .from('docks')
    .select('id')
    .eq('is_active', true)
    .or(`type.eq.DESCARGUE,and(type.eq.MIXTO,is_unloading_authorized.eq.true)`)
    .order('priority', { ascending: true })
  
  if (!docks || docks.length === 0) return []
  
  // 3. Obtener citas activas para el día seleccionado
  const { data: appointments } = await supabase
    .from('appointments')
    .select('scheduled_time, estimated_duration_minutes, scheduled_end_time, dock_id')
    .eq('scheduled_date', date)
    .neq('status', 'CANCELADO')

  const startHourMin = parseTime(settings.start_time);
  const endHourMin = parseTime(settings.end_time);
  
  const intervals: string[] = [];
  const STEP_MINUTES = 30; // Granularidad del selector de horarios
  
  // Normalización de bloques ocupados por muelle
  const bookedBlocks = (appointments || []).map(app => ({
    dockId: app.dock_id,
    start: parseTime(app.scheduled_time),
    end: app.scheduled_end_time 
      ? parseTime(app.scheduled_end_time) 
      : parseTime(app.scheduled_time) + (app.estimated_duration_minutes || 0)
  }))

  // Iteración sobre el horario operativo
  for (let t = startHourMin; t <= endHourMin - requiredRealMinutes; t += STEP_MINUTES) {
    const proposedStart = t;
    const proposedEnd = t + requiredRealMinutes;
    
    // Verificar si al menos un muelle tiene el bloque completo libre
    const hasAvailableDock = docks.some(dock => {
      // Buscar solapamientos para este muelle específico
      const hasConflict = bookedBlocks.some(block => 
        block.dockId === dock.id &&
        block.start < proposedEnd &&
        block.end > proposedStart
      );
      return !hasConflict;
    });
    
    if (hasAvailableDock) {
      intervals.push(formatTimeFromMinutes(proposedStart));
    }
  }

  return intervals;
}

/**
 * Convierte un string de tiempo (HH:MM o HH:MM:SS) a minutos absolutos desde las 00:00.
 */
export function parseTime(timeString: string) {
  if (!timeString) return 0;
  const parts = timeString.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

/**
 * Convierte minutos absolutos a formato de reloj HH:MM legible por humanos.
 */
export function formatTimeFromMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
