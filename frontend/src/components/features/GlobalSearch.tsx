import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Appointment } from "@/types"
import { AppointmentDetailsModal } from "@/app/(dashboard)/operacion/trazabilidad/components/AppointmentDetailsModal"
import { cn, capitalize } from "@/lib/utils"

export function GlobalSearch() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<Appointment[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  
  // Modal state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(handler)
  }, [query])

  // Fetch logic
  useEffect(() => {
    async function search() {
      if (!debouncedQuery.trim()) {
        setResults([])
        setIsOpen(false)
        return
      }

      setIsSearching(true)
      setIsOpen(true)

      const q = `%${debouncedQuery.trim()}%`

      // ILIKE OR on multiple fields to avoid expensive FTS storage cost
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(`company_name.ilike.${q},po_number.ilike.${q},driver_name.ilike.${q},license_plate.ilike.${q},appointment_number.ilike.${q}`)
        .order("created_at", { ascending: false })
        .limit(8)

      if (!error && data) {
        setResults(data)
      }
      setIsSearching(false)
    }

    search()
  }, [debouncedQuery])

  const handleSelect = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
    setIsOpen(false)
    setQuery("")
  }

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <div className="flex items-center gap-4 bg-white/40 border border-surface-container/50 hover:bg-white/60 focus-within:bg-white/80 focus-within:border-primary/30 transition-all rounded-xl px-4 py-2 relative z-50">
        <span className="material-symbols-outlined text-on-surface-variant">search</span>
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
          placeholder="Buscando en patio (Placa, Orden, Proveedor)..."
          className="bg-transparent border-none outline-none text-sm font-medium text-on-surface w-full placeholder:text-on-surface-variant/60"
        />
        {isSearching && (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin absolute right-4" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (query.trim() !== "") && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-2xl shadow-elevated border border-surface-container overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-96 overflow-y-auto p-2">
            {!isSearching && results.length === 0 ? (
              <div className="p-6 text-center text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-50 mb-2">search_off</span>
                <p>No se encontraron citas operativas para "{query}"</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {results.map((appointment) => (
                  <button 
                    key={appointment.id}
                    onClick={() => handleSelect(appointment)}
                    className="w-full text-left p-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-start gap-4 group"
                  >
                    <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform shrink-0">
                      <span className="material-symbols-outlined">local_shipping</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-bold text-on-surface truncate">{capitalize(appointment.company_name)}</p>
                        <span className="text-[9px] font-black tracking-widest uppercase bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant">
                          {capitalize(appointment.status)}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-[14px]">pin</span> {appointment.license_plate}</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">receipt_long</span> {appointment.po_number?.slice(0, 15)}...</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Reutilizado */}
      {isModalOpen && selectedAppointment && (
        <AppointmentDetailsModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          appointment={selectedAppointment}
          onSuccess={() => setIsModalOpen(false)} // Just close on success or let user view it
        />
      )}
    </div>
  )
}
