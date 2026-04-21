"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Appointment, CediSettings } from "@/types"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { DockTimeline } from "@/components/features/DockTimeline"
import { parseTime, formatTimeFromMinutes } from "@/lib/services/scheduling"
import {
  fetchTimelineAppointments,
  fetchTimelineDocks,
  TimelineAppointmentRow,
  TimelineDockRow,
} from "@/lib/services/appointments"
import { 
  shiftAndExtendAppointmentAction
} from "@/app/actions/appointments"
import { ConfirmModal } from "./components/ConfirmModal"
import { EditDockModal } from "./components/EditDockModal"
import { useUIStore } from "@/store/uiStore"

// El Timeline DE Muelles DEBE ser Client Component: requiere Realtime y DnD de bloques.
// Las optimizaciones se centran en queries granulares via el servicio de appointments.

export default function MuellesPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [appointments, setAppointments] = useState<TimelineAppointmentRow[]>([])
  const [docks, setDocks] = useState<TimelineDockRow[]>([])
  const [settings, setSettings] = useState<CediSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const {
    timelineConfirmModal: confirmModal,
    timelineEditModal: editModal,
    timelineExtendModal: extendModal,
    setTimelineConfirmModal: setConfirmModal,
    setTimelineEditModal: setEditModal,
    setTimelineExtendModal: setExtendModal,
    clearTimelineModals
  } = useUIStore()

  const supabase = createClient()

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Carga de datos centralizada ────────────────────────────
  // Promise.all ejecuta las 3 queries en paralelo; los servicios usan selects granulares.
  const fetchData = useCallback(async () => {
    const [sRes, docksData, appointmentsData] = await Promise.all([
      supabase.from("cedi_settings").select("id, start_time, end_time").single(),
      fetchTimelineDocks(supabase),
      fetchTimelineAppointments(supabase, date),
    ])

    if (sRes.data) setSettings(sRes.data as CediSettings)
    setDocks(docksData)
    setAppointments(appointmentsData)
    setLoading(false)
  }, [supabase, date])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // ─── Realtime subscription ─────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("muelles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () =>
        fetchData()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchData])

  // ─── Handlers ─────────────────────────────────────────────

  const handleAppointmentMove = useCallback(
    (appointmentId: string, newDockId: number, newTime: string) => {
      setConfirmModal({ appointmentId, newDockId, newTime })
    },
    [setConfirmModal]
  )

  const handleConfirmMove = async () => {
    if (!confirmModal) return
    setActionLoading(true)

    // Validación de colisión (en memoria, usando los datos ya cargados)
    const appt = appointments.find((a) => a.id === confirmModal.appointmentId)
    const duration = appt?.estimated_duration_minutes || 60
    const proposedStartMin = parseTime(confirmModal.newTime)
    const proposedEndMin = proposedStartMin + duration

    const hasCollision = appointments.some(
      (a) =>
        a.id !== confirmModal.appointmentId &&
        a.dock_id === confirmModal.newDockId &&
        a.status !== "CANCELADO" &&
        parseTime(a.scheduled_time) < proposedEndMin &&
        (parseTime(a.scheduled_end_time || "") ||
          parseTime(a.scheduled_time) + (a.estimated_duration_minutes || 60)) > proposedStartMin
    )

    if (hasCollision) {
      showToast("Conflicto: El espacio en el muelle no está disponible.", "error")
      setActionLoading(false)
      clearTimelineModals()
      return
    }

    const newEndTime = formatTimeFromMinutes(proposedEndMin)

    const { error, success } = await shiftAndExtendAppointmentAction({
      appointmentId: confirmModal.appointmentId,
      newDockId: confirmModal.newDockId,
      newStartTime: confirmModal.newTime,
      newEndTime: newEndTime + ":00"
    })

    setActionLoading(false)
    clearTimelineModals()

    if (!success) {
      showToast(error || "Error al reubicar la cita.", "error")
    } else {
      showToast("Cita reubicada exitosamente.", "success")
      fetchData()
    }
  }

  const handleAppointmentEdit = useCallback((appointment: Appointment) => {
    setEditModal(appointment)
  }, [setEditModal])

  const handleSaveEdit = async (
    id: string,
    dockId: number,
    time: string,
    endTime: string
  ) => {
    setActionLoading(true)

    const newStartMin = parseTime(time)
    const newEndMin = parseTime(endTime)
    const newDuration = newEndMin - newStartMin

    const hasCollision = appointments.some(
      (a) =>
        a.id !== id &&
        a.dock_id === dockId &&
        a.status !== "CANCELADO" &&
        a.status !== "FINALIZADO" &&
        parseTime(a.scheduled_time) < newEndMin &&
        (a.scheduled_end_time
          ? parseTime(a.scheduled_end_time)
          : parseTime(a.scheduled_time) + (a.estimated_duration_minutes || 60)) > newStartMin
    )

    if (hasCollision) {
      showToast(
        "Conflicto: El cambio choca con otra cita programada en este muelle.",
        "error"
      )
      setActionLoading(false)
      return
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        dock_id: dockId,
        scheduled_time: time,
        scheduled_end_time: endTime,
        estimated_duration_minutes: newDuration > 0 ? newDuration : undefined,
      })
      .eq("id", id)

    setActionLoading(false)
    clearTimelineModals()

    if (error) {
      showToast("Error al actualizar la cita.", "error")
    } else {
      showToast("Cita actualizada.", "success")
      fetchData()
    }
  }

  const handleConfirmExtendAction = useCallback(
    async (id: string, endTime: string) => {
      setActionLoading(true)

      const { error, success } = await shiftAndExtendAppointmentAction({
        appointmentId: id,
        newEndTime: endTime
      })

      setActionLoading(false)
      clearTimelineModals()

      if (!success) {
        showToast(error || "Error al extender cita. Posible conflicto de muelles.", "error")
      } else {
        showToast("Agenda ajustada correctamente.", "success")
        fetchData()
      }
    },
    [fetchData, clearTimelineModals]
  )

  const handleAppointmentExtend = useCallback(
    (appointmentId: string, newEndTime?: string) => {
      if (newEndTime) {
        handleConfirmExtendAction(appointmentId, newEndTime)
      } else {
        setExtendModal(appointmentId)
      }
    },
    [handleConfirmExtendAction, setExtendModal]
  )

  const handleConfirmExtend = async () => {
    if (!extendModal) return
    const appt = appointments.find((a) => a.id === extendModal)
    if (!appt) return

    const currentEndMin =
      parseTime(appt.scheduled_end_time || "") ||
      parseTime(appt.scheduled_time) + (appt.estimated_duration_minutes || 60)
    const newEndMin = currentEndMin + 30
    const h = Math.floor(newEndMin / 60)
    const m = newEndMin % 60
    const newEndTimeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`

    handleConfirmExtendAction(extendModal, newEndTimeStr)
  }

  // ─── Stats derivados ───────────────────────────────────────
  const activeDocks = docks.length
  const occupiedDocks = new Set(
    appointments.filter((a) => ["EN_MUELLE", "DESCARGANDO"].includes(a.status)).map((a) => a.dock_id)
  ).size
  const totalAppointments = appointments.length

  const confirmDock = confirmModal ? docks.find((d) => d.id === confirmModal.newDockId) : null
  const confirmAppt = confirmModal
    ? appointments.find((a) => a.id === confirmModal.appointmentId)
    : null

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-xl shadow-float font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
            toast.type === "success"
              ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
              : "bg-error-container text-on-error-container"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">
            Visualización de Recursos
          </p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">
            MUELLES
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex gap-3">
            <Card className="px-4 py-2.5 flex items-center gap-3 bg-white/50 border-none shadow-ambient">
              <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-tertiary">warehouse</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">
                  Muelles
                </p>
                <p className="text-lg font-black font-headline leading-none">
                  {occupiedDocks}/{activeDocks}
                </p>
              </div>
            </Card>
            <Card className="px-4 py-2.5 flex items-center gap-3 bg-white/50 border-none shadow-ambient">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-primary">local_shipping</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">
                  Citas
                </p>
                <p className="text-lg font-black font-headline leading-none">{totalAppointments}</p>
              </div>
            </Card>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date(date)
                d.setDate(d.getDate() - 1)
                setDate(d.toISOString().split("T")[0])
              }}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[180px] text-center font-bold"
            />
            <button
              onClick={() => {
                const d = new Date(date)
                d.setDate(d.getDate() + 1)
                setDate(d.toISOString().split("T")[0])
              }}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {loading || !settings ? (
        <div className="h-[400px] animate-pulse bg-surface-container rounded-2xl flex items-center justify-center">
          <p className="text-sm font-bold text-on-surface-variant/40">Cargando línea de tiempo...</p>
        </div>
      ) : docks.length === 0 ? (
        <Card variant="elevated" className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-primary/20 mb-4">warehouse</span>
          <h3 className="text-xl font-black font-headline text-on-surface/60">Sin Muelles Configurados</h3>
          <p className="text-sm text-on-surface-variant/50 mt-2 max-w-sm mx-auto">
            Dirígete a Configuración CEDI para crear muelles antes de visualizar la línea de tiempo.
          </p>
        </Card>
      ) : (
        <DockTimeline
          date={date}
          appointments={appointments}
          docks={docks}
          settings={settings}
          onAppointmentMove={handleAppointmentMove}
          onAppointmentExtend={handleAppointmentExtend}
          onAppointmentEdit={handleAppointmentEdit}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {[
          { label: "Pendiente", cls: "bg-surface-container-highest" },
          { label: "En Patio", cls: "bg-secondary-fixed" },
          { label: "En Muelle", cls: "bg-tertiary-fixed/60" },
          { label: "Descargando", cls: "bg-tertiary-fixed" },
          { label: "Finalizado", cls: "bg-primary-fixed" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${s.cls}`} />
            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-on-surface-variant/30 font-bold uppercase tracking-widest">
        Arrastra para reubicar · Doble clic para editar · Hover en el botón de reloj para extender tiempo
      </p>

      {/* ═══ Confirm Move Modal ═══ */}
      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={clearTimelineModals}
        onConfirm={handleConfirmMove}
        loading={actionLoading}
        title="Confirmar Reubicación"
        message={`¿Deseas mover la cita de ${confirmAppt?.license_plate || ""} (${confirmAppt?.company_name || ""}) al ${confirmDock?.name || "muelle seleccionado"} a las ${confirmModal?.newTime?.substring(0, 5) || ""}?`}
      />

      {/* ═══ Edit Dock Modal ═══ */}
      <EditDockModal
        isOpen={!!editModal}
        onClose={clearTimelineModals}
        appointment={editModal}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        docks={docks as any}
        onSave={handleSaveEdit}
        loading={actionLoading}
      />

      {/* ═══ Extend Time Modal ═══ */}
      <ConfirmModal
        isOpen={!!extendModal}
        onClose={clearTimelineModals}
        onConfirm={handleConfirmExtend}
        loading={actionLoading}
        title="Extender Tiempo de Descarga"
        message={`¿Deseas extender 30 minutos adicionales al tiempo de descarga de ${
          appointments.find((a) => a.id === extendModal)?.license_plate || "esta cita"
        }? Esto actualizará la hora de fin en la línea de tiempo.`}
      />
    </div>
  )
}
