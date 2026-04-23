"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/store/uiStore"
import { TimelineAppointmentRow } from "@/lib/services/appointments"
import { formatTimeFromMinutes, parseTime } from "@/lib/services/scheduling"
import { updateAppointmentStatusAction } from "@/app/actions/appointments"
import type { AppointmentStatus } from "@/types"

// ─── Status Config ────────────────────────────────────────────

interface StatusConfig {
  label: string
  icon: string
  bgColor: string
  textColor: string
  nextStatus: AppointmentStatus | null
  nextLabel: string
  nextIcon: string
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDIENTE: {
    label: 'Pendiente',
    icon: 'hourglass_top',
    bgColor: 'bg-surface-container-highest/60',
    textColor: 'text-on-surface-variant',
    nextStatus: 'EN_PORTERIA',
    nextLabel: 'Confirmar Llegada',
    nextIcon: 'where_to_vote'
  },
  EN_PORTERIA: {
    label: 'En Portería',
    icon: 'where_to_vote',
    bgColor: 'bg-secondary-fixed/50',
    textColor: 'text-on-secondary-fixed-variant',
    nextStatus: 'EN_MUELLE',
    nextLabel: 'Asignar a Muelle',
    nextIcon: 'dock'
  },
  EN_MUELLE: {
    label: 'En Muelle',
    icon: 'dock',
    bgColor: 'bg-tertiary-fixed/30',
    textColor: 'text-on-tertiary-fixed-variant',
    nextStatus: 'DESCARGANDO',
    nextLabel: 'Iniciar Descarga',
    nextIcon: 'download'
  },
  DESCARGANDO: {
    label: 'Descargando',
    icon: 'download',
    bgColor: 'bg-tertiary-fixed',
    textColor: 'text-on-tertiary-fixed',
    nextStatus: 'FINALIZADO',
    nextLabel: 'Finalizar Descarga',
    nextIcon: 'check_circle'
  },
  FINALIZADO: {
    label: 'Finalizado',
    icon: 'check_circle',
    bgColor: 'bg-primary-fixed/30',
    textColor: 'text-on-primary-fixed-variant',
    nextStatus: null,
    nextLabel: '',
    nextIcon: ''
  },
  CANCELADO: {
    label: 'Cancelado',
    icon: 'cancel',
    bgColor: 'bg-error-container/40',
    textColor: 'text-on-error-container',
    nextStatus: null,
    nextLabel: '',
    nextIcon: ''
  },
}

// ─── Helpers ─────────────────────────────────────────────────

function TimeRow({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-surface-container/50 last:border-0">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn(
        "text-[11px] font-black",
        value ? "text-on-surface" : "text-on-surface-variant/30"
      )}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-2 px-1">{title}</p>
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function AppointmentDrawer() {
  const {
    timelineDrawerAppointment: appt,
    isTimelineDrawerOpen,
    closeTimelineDrawer,
    updateDrawerAppointment,
  } = useUIStore()

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!appt) return null

  const statusCfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.PENDIENTE
  const totalBoxes = appt.appointment_purchase_orders
    ?.reduce((s, po) => s + (po.box_count || 0), 0) || appt.box_count || 0

  const handleStatusAdvance = async () => {
    if (!statusCfg.nextStatus || actionLoading) return
    setActionLoading(true)
    setActionError(null)

    const { success, error } = await updateAppointmentStatusAction({
      appointmentId: appt.id,
      newStatus: statusCfg.nextStatus
    })

    setActionLoading(false)

    if (!success) {
      setActionError(error || 'Error al cambiar el estado.')
      return
    }

    // Optimistic update: reflect change immediately without waiting for Realtime
    updateDrawerAppointment({ status: statusCfg.nextStatus })
  }

  const fmt = (time: string | null) =>
    time ? formatTimeFromMinutes(parseTime(time)) : null

  return (
    <>
      {/* ── Backdrop ────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity duration-300",
          isTimelineDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeTimelineDrawer}
      />

      {/* ── Drawer Panel ────────────────────────────────────── */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-[360px] z-50 flex flex-col",
          "bg-surface-container-lowest border-l border-surface-container shadow-float",
          "transition-transform duration-300 ease-in-out",
          isTimelineDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-5 py-4 border-b border-surface-container",
          statusCfg.bgColor
        )}>
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <p className="text-xs font-black uppercase tracking-widest text-on-surface/50">Cita</p>
              <p className="text-xl font-black tracking-tight text-on-surface leading-tight">
                {appt.license_plate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black",
              statusCfg.bgColor, statusCfg.textColor,
              "border border-current/20"
            )}>
              <span className="material-symbols-outlined text-[12px]">{statusCfg.icon}</span>
              {statusCfg.label}
            </div>
            <button
              onClick={closeTimelineDrawer}
              className="p-2 rounded-xl hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Identity */}
          <Section title="Identificación">
            <div className="bg-surface-container rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">business</span>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Empresa</p>
                  <p className="text-sm font-black text-on-surface leading-tight">{appt.company_name}</p>
                </div>
              </div>
              {appt.driver_name && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary/60">person</span>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Conductor</p>
                    <p className="text-[11px] font-bold text-on-surface">{appt.driver_name}</p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Scheduled Times */}
          <Section title="Planificado">
            <div className="bg-surface-container rounded-xl p-3">
              <TimeRow icon="schedule" label="Inicio" value={fmt(appt.scheduled_time)} />
              <TimeRow icon="schedule" label="Fin" value={appt.scheduled_end_time ? fmt(appt.scheduled_end_time) : null} />
              <TimeRow icon="timer" label="Duración" value={appt.estimated_duration_minutes ? `${appt.estimated_duration_minutes}m` : null} />
            </div>
          </Section>

          {/* Real Operational Times */}
          <Section title="Real Operativo">
            <div className="bg-surface-container rounded-xl p-3">
              <TimeRow icon="where_to_vote" label="Llegada" value={fmt(appt.arrival_time)} />
              <TimeRow icon="dock" label="Acceso Muelle" value={fmt(appt.docking_time)} />
              <TimeRow icon="download" label="Inicio Descarga" value={fmt(appt.start_unloading_time)} />
              <TimeRow icon="check_circle" label="Fin Descarga" value={fmt(appt.end_unloading_time)} />
            </div>
          </Section>

          {/* Purchase Orders */}
          <Section title={`Órdenes de Compra · ${totalBoxes} cajas total`}>
            <div className="space-y-2">
              {appt.appointment_purchase_orders && appt.appointment_purchase_orders.length > 0
                ? appt.appointment_purchase_orders.map(po => (
                  <div
                    key={po.id}
                    className="bg-surface-container rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] text-primary">receipt</span>
                      <span className="text-[11px] font-black text-on-surface">OC: {po.po_number}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-[12px] text-primary">inventory_2</span>
                      <span className="text-[10px] font-black text-primary">{po.box_count} cj</span>
                    </div>
                  </div>
                ))
                : (
                  <div className="bg-surface-container rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant/40">Sin órdenes registradas</p>
                  </div>
                )
              }
            </div>
          </Section>

          {/* Error feedback */}
          {actionError && (
            <div className="bg-error-container/40 border border-error/20 rounded-xl p-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-error">error</span>
              <p className="text-[11px] font-bold text-on-error-container">{actionError}</p>
            </div>
          )}
        </div>

        {/* ── Action Footer ─────────────────────────────────── */}
        {statusCfg.nextStatus && (
          <div className="px-5 py-4 border-t border-surface-container bg-surface-container-lowest/80 backdrop-blur-sm space-y-2">
            <button
              onClick={handleStatusAdvance}
              disabled={actionLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl",
                "text-sm font-black transition-all",
                "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                actionLoading && "animate-pulse"
              )}
            >
              {actionLoading
                ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-[16px]">{statusCfg.nextIcon}</span>
              }
              {actionLoading ? 'Procesando...' : statusCfg.nextLabel}
            </button>
            <p className="text-[9px] text-center text-on-surface-variant/40 font-bold">
              Los cambios se sincronizarán en tiempo real con el Gantt.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
