"use client"

interface ResumenDatePickerProps {
  date: string
  onChange: (date: string) => void
}

/**
 * Selector de fecha interactivo para la vista de Resumen Diario.
 * Extraído como Client Component mínimo para que la página padre pueda ser Server Component.
 *
 * El formulario controla la navegación entre días vía el parámetro `date` en la URL
 * (router.push) para que el Server Component se re-hidrate con los datos del nuevo día.
 */
export function ResumenDatePicker({ date, onChange }: ResumenDatePickerProps) {
  const navigate = (direction: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + direction)
    onChange(d.toISOString().split("T")[0])
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-1)}
        className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
      >
        <span className="material-symbols-outlined text-sm">chevron_left</span>
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="flex w-[180px] rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-3 text-sm font-bold text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        onClick={() => navigate(1)}
        className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
      >
        <span className="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    </div>
  )
}
