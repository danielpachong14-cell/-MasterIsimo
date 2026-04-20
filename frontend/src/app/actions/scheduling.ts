"use server"

import { createClient } from "@/lib/supabase/server"
import { runSchedulingEngine, SchedulingRequest, SchedulingResult } from "@/lib/services/scheduling-engine"

/**
 * Server Action que ejecuta el motor de scheduling en el servidor.
 *
 * Razón de existir: `SupplierForm` es un Client Component (requiere interactividad),
 * pero el motor de scheduling NUNCA debe ejecutarse en el cliente por motivos de
 * seguridad y rendimiento. Esta Action actúa como puente, manteniendo el engine
 * 100% server-side mientras el formulario sigue siendo reactivo.
 *
 * El cliente llama a esta función como si fuera una función asíncrona normal;
 * Next.js serializa la llamada como POST a un endpoint interno de forma transparente.
 */
export async function scheduleEngineAction(
  request: SchedulingRequest
): Promise<SchedulingResult> {
  const supabase = await createClient()
  return runSchedulingEngine(supabase, request)
}
