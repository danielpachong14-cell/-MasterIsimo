"use client"

import { useState, useEffect, useCallback } from "react"
import { KanbanBoard } from "@/components/features/KanbanBoard"
import { Card } from "@/components/ui/Card"
import { createClient } from "@/lib/supabase/client"
import { AppointmentStatus, Dock } from "@/types"
import { AppointmentDetailsModal } from "../trazabilidad/components/AppointmentDetailsModal"
import {
  KanbanAppointmentRow,
  fetchKanbanAppointments,
  buildStatusTransitionUpdates,
} from "@/lib/services/appointments"

// El Kanban DEBE ser Client Component: requiere Realtime (WebSocket) y DnD interactivo.
// Las optimizaciones se centran en reducir el payload de cada cita ~80% via queries granulares.

export default function KanbanPage() {
  const [appointments, setAppointments] = useState<KanbanAppointmentRow[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  // Usamos `KanbanAppointmentRow | null` para el modal de detalles.
  // El modal de detalles acepta `Appointment` completo — lo casteamos ya que la proyección
  // incluye todos los campos que el modal necesita para operar.
  const [selectedAppt, setSelectedAppt] = useState<KanbanAppointmentRow | null>(null)

  const supabase = createClient()

  // ─── Carga centralizada de datos ────────────────────────────
  const fetchData = useCallback(async () => {
    // Obtenemos la fecha actual en la zona horaria del CEDI (Colombia)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

    // Appointments: usa el servicio granular (solo 14 campos vs. 30+)
    const apptData = await fetchKanbanAppointments(supabase, today)
    setAppointments(apptData)

    // Docks: solo los campos necesarios para el cómputo de KPIs
    const { data: docksData } = await supabase
      .from("docks")
      .select("id, name, is_active, type, is_unloading_authorized, priority, environment_id")
      .eq("is_active", true)

    if (docksData) setDocks(docksData as Dock[])
  }, [supabase])

  // ─── Realtime subscriptions ────────────────────────────────
  useEffect(() => {
    fetchData()

    const channelAppointments = supabase
      .channel("kanban-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        fetchData()
      })
      .subscribe()

    const channelDocks = supabase
      .channel("kanban-docks")
      .on("postgres_changes", { event: "*", schema: "public", table: "docks" }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelAppointments)
      supabase.removeChannel(channelDocks)
    }
  }, [supabase, fetchData])

  // ─── KPI computations (derivados del estado local) ─────────
  const enEspera = appointments.filter((a) =>
    ["PENDIENTE", "EN_PORTERIA"].includes(a.status)
  ).length

  const enMuelleOcupados = appointments.filter((a) =>
    ["EN_MUELLE", "DESCARGANDO"].includes(a.status)
  ).length
  const totalActivos = docks.length || 12
  const muellesLibres = Math.max(0, totalActivos - enMuelleOcupados)

  const totalEvaluados = appointments.filter((a) => a.punctuality_status).length
  const aTiempo = appointments.filter(
    (a) => a.punctuality_status && a.punctuality_status !== "TARDE"
  ).length
  const eficiencia =
    totalEvaluados > 0 ? Math.round((aTiempo / totalEvaluados) * 100) : 100

  // ─── Actualizador de estado unificado ─────────────────────
  // La lógica de timestamps de trazabilidad está centralizada en buildStatusTransitionUpdates.
  const updateAppointmentStatus = async (id: string, newStatus: AppointmentStatus) => {
    const existing = appointments.find((a) => a.id === id)
    if (!existing) return

    const updates = buildStatusTransitionUpdates(existing, newStatus)

    // Optimistic update: aplica el cambio en UI inmediatamente
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    )

    // Sincronización con servidor
    const { error } = await supabase
      .from("appointments")
      .update(updates)
      .eq("id", id)

    // Revert si el servidor rechaza el cambio
    if (error) {
      console.error("[KanbanPage] Error updating status:", error)
      fetchData()
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Dashboard Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">Vista Operativa</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">PANEL DE PATIO</h1>
        </div>

        {/* Real-time Bento Stats */}
        <div className="flex flex-wrap gap-4">
          <Card className="px-6 py-4 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">local_shipping</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">En Espera</p>
              <p className="text-2xl font-black font-headline leading-none">{enEspera}</p>
            </div>
          </Card>

          <Card className="px-6 py-4 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary">stadium</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Muelles Libres</p>
              <p className="text-2xl font-black font-headline leading-none">{muellesLibres}/{totalActivos}</p>
            </div>
          </Card>

          <Card
            className={`px-6 py-4 flex items-center gap-4 ${
              eficiencia < 80 ? "bg-error-container text-on-error-container" : "bg-primary-container text-white"
            } border-none shadow-elevated transition-colors`}
          >
            <div
              className={`w-12 h-12 rounded-xl ${
                eficiencia < 80 ? "bg-error text-on-error" : "bg-primary text-white"
              } flex items-center justify-center`}
            >
              <span className="material-symbols-outlined">
                {eficiencia < 80 ? "warning" : "speed"}
              </span>
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Eficiencia</p>
              <p className="text-2xl font-black font-headline leading-none">{eficiencia}%</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Kanban Board Area */}
      <KanbanBoard
        appointments={appointments as unknown as Parameters<typeof KanbanBoard>[0]['appointments']}
        onStatusChange={updateAppointmentStatus}
        onCardClick={(appt) => setSelectedAppt(appt as unknown as KanbanAppointmentRow)}
      />

      <AppointmentDetailsModal
        isOpen={!!selectedAppt}
        onClose={() => setSelectedAppt(null)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appointment={selectedAppt as any}
        onSuccess={fetchData}
      />
    </div>
  )
}
