"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { CediSettings } from "@/types"
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
  recalculateTimelineCascade,
  extendAppointmentAutomaticallyAction,
  assignFromWaitlistAction
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

  // Estado para la sugerencia inteligente de reslotting
  const [smartCollisionModal, setSmartCollisionModal] = useState<{
    appointmentId: string;
    originalTargetDockId: number;
    newTime: string;
    suggestedDockId: number | null;
  } | null>(null)

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
      // SMART COLLISION DETECTION: Buscar si hay otro muelle libre en ese mismo instante
      const availableDock = docks.find(d => {
        if (d.id === confirmModal.newDockId) return false;

        const collidesInThisDock = appointments.some(
          a => a.dock_id === d.id &&
            a.status !== "CANCELADO" &&
            parseTime(a.scheduled_time) < proposedEndMin &&
            (parseTime(a.scheduled_end_time || "") || parseTime(a.scheduled_time) + (a.estimated_duration_minutes || 60)) > proposedStartMin
        );
        return !collidesInThisDock;
      });

      clearTimelineModals()
      setSmartCollisionModal({
        appointmentId: confirmModal.appointmentId,
        originalTargetDockId: confirmModal.newDockId,
        newTime: confirmModal.newTime,
        suggestedDockId: availableDock?.id || null
      });
      return;
    }

    // No hay colisión, aplicar normalmente
    await executeCascadeMove(confirmModal.appointmentId, confirmModal.newDockId, confirmModal.newTime, proposedEndMin)
  }

  const executeCascadeMove = async (appointmentId: string, dockId: number, newTime: string, proposedEndMin: number) => {
    setActionLoading(true)
    const newEndTime = formatTimeFromMinutes(proposedEndMin) + ":00"

    const { error, success } = await recalculateTimelineCascade({
      appointmentId: appointmentId,
      newDockId: dockId,
      newStartTime: newTime,
      newEndTime: newEndTime
    })

    setActionLoading(false)
    clearTimelineModals()
    setSmartCollisionModal(null)

    if (!success) {
      showToast(error || "Error al reubicar la cita.", "error")
    } else {
      showToast("Cita reubicada exitosamente.", "success")
      fetchData()
    }
  }

  const handleDropFromWaitlist = async (appointmentId: string, dockId: number, startTime: string) => {
    setActionLoading(true)
    const { success, error } = await assignFromWaitlistAction({
      appointmentId,
      dockId,
      date,
      startTime
    });

    setActionLoading(false);
    if (!success) {
      showToast(error || "Error asignando cita desde espera.", "error");
    } else {
      showToast("Cita programada correctamente desde espera.", "success");
      fetchData();
    }
  }

  const handleAutoExtend = async (appointmentId: string) => {
    await extendAppointmentAutomaticallyAction(appointmentId);
    showToast("Extensión automática aplicada a muelle demorado.", "error"); // Use error styling to act as warning
    fetchData();
  }

  const handleAppointmentEdit = useCallback((appointment: TimelineAppointmentRow) => {
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

      const { error, success } = await recalculateTimelineCascade({
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
  const timelineAppointments = appointments.filter(a => a.status !== 'EN_ESPERA');
  const waitlistAppointments = appointments.filter(a => a.status === 'EN_ESPERA');
  const totalAppointments = timelineAppointments.length

  const confirmDock = confirmModal ? docks.find((d) => d.id === confirmModal.newDockId) : null
  const confirmAppt = confirmModal
    ? appointments.find((a) => a.id === confirmModal.appointmentId)
    : null

  const smartModalSuggestedDock = smartCollisionModal?.suggestedDockId ? docks.find(d => d.id === smartCollisionModal.suggestedDockId) : null;

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-xl shadow-float font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${toast.type === "success"
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

      {/* Timeline & Waitlist Area */}
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
        <div className="flex gap-6 h-[700px] min-h-[60vh]">
          {/* Waitlist Sidebar */}
          <div className="w-64 flex-shrink-0 flex flex-col bg-surface-container-lowest border border-surface-container rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-surface-container bg-surface-container-low/50">
              <h3 className="text-sm font-black text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-base">hourglass_top</span>
                EN ESPERA
                <span className="ml-auto bg-error/10 text-error px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {waitlistAppointments.length}
                </span>
              </h3>
              <p className="text-[10px] text-on-surface-variant mt-1 leading-tight">
                Arrastra hacia la línea de tiempo para reasignar.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-surface-container-lowest/50">
              {waitlistAppointments.length === 0 && (
                <div className="py-8 text-center px-4">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/20 mb-2">check_circle</span>
                  <p className="text-xs text-on-surface-variant/60 font-medium">No hay citas en espera.</p>
                </div>
              )}
              {waitlistAppointments.map((appt) => (
                <div
                  key={appt.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", appt.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  className="bg-white border-2 border-dashed border-primary/20 p-3 rounded-xl cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-black uppercase text-on-surface group-hover:text-primary transition-colors">{appt.license_plate}</p>
                    <span className="text-[10px] opacity-60 font-bold">{appt.scheduled_time.substring(0, 5)}</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-medium truncate mb-2">{appt.company_name}</p>

                  <div className="flex gap-2">
                    <span className="text-[9px] bg-surface-container px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">inventory_2</span>
                      {appt.box_count || 0}
                    </span>
                    <span className="text-[9px] bg-surface-container px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">timer</span>
                      {appt.estimated_duration_minutes}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-surface-container shadow-sm">
            <DockTimeline
              date={date}
              appointments={timelineAppointments}
              docks={docks}
              settings={settings}
              onAppointmentMove={handleAppointmentMove}
              onAppointmentExtend={handleAppointmentExtend}
              onAppointmentEdit={handleAppointmentEdit}
              onAutoExtend={handleAutoExtend}
              onDropFromWaitlist={handleDropFromWaitlist}
            />
          </div>
        </div>
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

      {/* ═══ Smart Collision Modal ═══ */}
      <ConfirmModal
        isOpen={!!smartCollisionModal}
        onClose={() => setSmartCollisionModal(null)}
        onConfirm={async () => {
          if (!smartCollisionModal) return;
          const { appointmentId, newTime } = smartCollisionModal;

          let duration = 60;
          const appt = appointments.find(a => a.id === appointmentId);
          if (appt) duration = appt.estimated_duration_minutes || 60;

          const proposedEndMin = parseTime(newTime) + duration;

          if (smartCollisionModal.suggestedDockId) {
            // Mover al muelle sugerido
            await executeCascadeMove(appointmentId, smartCollisionModal.suggestedDockId, newTime, proposedEndMin)
          } else {
            // No hay muelle, simplemente forzar el empuje de todos
            await executeCascadeMove(appointmentId, smartCollisionModal.originalTargetDockId, newTime, proposedEndMin)
          }
        }}
        loading={actionLoading}
        title={smartCollisionModal?.suggestedDockId ? "Conflicto Detectado - Sugerencia" : "Conflicto de Citas"}
        message={smartCollisionModal?.suggestedDockId ?
          `El ${docks.find(d => d.id === smartCollisionModal?.originalTargetDockId)?.name} está ocupado en ese horario. Sin embargo, el sistema ha detectado que el ${smartModalSuggestedDock?.name} está LIBRE y es compatible.\n\n¿Deseas aceptar la sugerencia inteligente y enviarlo al ${smartModalSuggestedDock?.name}, o ignorar y empujar en CASCADA todas las citas?` :
          `No hay muelles alternativos. Si guardas, las citas subsecuentes serán desplazadas en cascada hacia el futuro para liberar espacio.`
        }
        confirmText={smartCollisionModal?.suggestedDockId ? "Aceptar Sugerencia (Cambiar Muelle)" : "Forzar y Empujar (Cascada)"}
        cancelText="Cancelar"
      />

      {/* ═══ Extend Time Modal ═══ */}
      <ConfirmModal
        isOpen={!!extendModal}
        onClose={clearTimelineModals}
        onConfirm={handleConfirmExtend}
        loading={actionLoading}
        title="Extender Tiempo de Descarga"
        message={`¿Deseas extender 30 minutos adicionales al tiempo de descarga de ${appointments.find((a) => a.id === extendModal)?.license_plate || "esta cita"
          }? Esto actualizará la hora de fin en la línea de tiempo.`}
      />
    </div>
  )
}
