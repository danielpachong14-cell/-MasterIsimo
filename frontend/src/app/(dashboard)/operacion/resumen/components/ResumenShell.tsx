"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ResumenDatePicker } from "./ResumenDatePicker"

/**
 * Shell interactiva para el Resumen Diario.
 * Este componente mínimo contiene SOLO la lógica de navegación de fechas,
 * permitiendo que la página padre sea un Server Component puro.
 *
 * Al cambiar la fecha, actualiza el searchParam ?date= para que el
 * Server Component reciba el nuevo valor y re-ejecute el fetch en el servidor.
 */
export function ResumenShell({ currentDate }: { currentDate: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleDateChange = (newDate: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", newDate)
    router.push(`?${params.toString()}`)
  }

  return <ResumenDatePicker date={currentDate} onChange={handleDateChange} />
}
