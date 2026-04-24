"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/store/uiStore"
import { cn, capitalize } from "@/lib/utils"
import { fetchDailySummaryAction, markAppointmentsAsNoShowAction } from "@/app/actions/appointments"
import type { DailySummary, Appointment } from "@/types"

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string
  value: string | number
  subValue?: string
  icon: string
  color: "default" | "success" | "danger" | "warning" | "info"
  pulse?: boolean
}

const COLOR_MAP: Record<KPICardProps["color"], { card: string; icon: string; label: string }> = {
  default:  { card: "bg-surface-container-low border-surface-container",    icon: "text-on-surface-variant", label: "text-on-surface-variant" },
  success:  { card: "bg-emerald-50 border-emerald-200",   icon: "text-emerald-600",  label: "text-emerald-700" },
  danger:   { card: "bg-red-50 border-red-200",           icon: "text-red-600",      label: "text-red-700" },
  warning:  { card: "bg-amber-50 border-amber-200",       icon: "text-amber-600",    label: "text-amber-700" },
  info:     { card: "bg-indigo-50 border-indigo-200",     icon: "text-indigo-600",   label: "text-indigo-700" },
}

function KPICard({ label, value, subValue, icon, color, pulse }: KPICardProps) {
  const c = COLOR_MAP[color]
  return (
    <div className={cn("rounded-xl border p-3 flex flex-col gap-1.5", c.card)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("material-symbols-outlined text-[16px]", c.icon, pulse && "animate-pulse")}>{icon}</span>
        <span className={cn("text-[10px] font-black uppercase tracking-widest", c.label)}>{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-black text-on-surface">{value}</span>
        {subValue && <span className="text-xs text-on-surface-variant mb-0.5">{subValue}</span>}
      </div>
    </div>
  )
}

// ─── Service Level Bar ─────────────────────────────────────────────────────────

function ServiceLevelBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"
  const textColor = pct >= 85 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-red-700"
  return (
    <div className="rounded-xl border bg-surface-container-low border-surface-container p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-indigo-600">speed</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Nivel de Servicio</span>
        </div>
        <span className={cn("text-xl font-black", textColor)}>{pct}%</span>
      </div>
      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[9px] text-on-surface-variant/60">
        {pct >= 85 ? "Excelente — Objetivo cumplido" : pct >= 60 ? "Aceptable — Por debajo del objetivo" : "Crítico — Requiere revisión"}
      </span>
    </div>
  )
}

// ─── Average Times Strip ───────────────────────────────────────────────────────

function AvgTimeRow({ label, minutes, color }: { label: string; minutes: number | null; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-[10px] font-black uppercase tracking-tight", color)}>{label}</span>
      <span className="text-sm font-bold text-on-surface">
        {minutes !== null ? `${minutes} min` : <span className="text-on-surface-variant/40 text-xs italic">Sin datos</span>}
      </span>
    </div>
  )
}

// ─── Pending Appointment Row ───────────────────────────────────────────────────

interface PendingRowProps {
  appt: Appointment
  selected: boolean
  onToggle: (id: string) => void
}

function PendingRow({ appt, selected, onToggle }: PendingRowProps) {
  return (
    <tr
      className={cn(
        "group cursor-pointer transition-colors",
        selected ? "bg-red-50" : "hover:bg-surface-container-lowest"
      )}
      onClick={() => onToggle(appt.id)}
    >
      <td className="pl-4 pr-2 py-2.5" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(appt.id)}
          className="w-4 h-4 rounded border-surface-container-high accent-red-600 cursor-pointer"
        />
      </td>
      <td className="px-2 py-2.5">
        <span className="text-[9px] font-mono text-on-surface-variant bg-surface-container px-1 rounded">
          {appt.id.split("-")[0]}
        </span>
      </td>
      <td className="px-2 py-2.5">
        <span className="font-semibold text-xs text-on-surface">{capitalize(appt.company_name)}</span>
      </td>
      <td className="px-2 py-2.5">
        <span className="text-xs font-bold text-on-surface-variant uppercase">{appt.license_plate}</span>
      </td>
      <td className="px-2 py-2.5">
        <span className="text-xs text-on-surface-variant">
          {appt.scheduled_time?.substring(0, 5)}
        </span>
      </td>
      <td className="px-2 pr-4 py-2.5">
        <span className={cn(
          "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
          appt.status === "PENDIENTE"
            ? "bg-surface-container-high text-on-surface border-surface-container-high"
            : "bg-amber-100 text-amber-800 border-amber-200"
        )}>
          {appt.status === "EN_ESPERA" ? "En Espera" : "Pendiente"}
        </span>
      </td>
    </tr>
  )
}

// ─── Main EOD Drawer ───────────────────────────────────────────────────────────

export function EODDrawer({ onSuccess }: { onSuccess?: () => void }) {
  const {
    isEODDrawerOpen, eodDate, eodSelectedIds,
    closeEODDrawer, toggleEODSelection, selectAllEOD, clearEODSelection
  } = useUIStore()

  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [pendingAppts, setPendingAppts] = useState<Appointment[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [pendingLoading, setPendingLoading] = useState(false)

  // Confirmation step before committing bulk action
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<number | null>(null)

  const supabase = createClient()

  const loadSummary = useCallback(async () => {
    if (!eodDate) return
    setSummaryLoading(true)
    setSummaryError(null)
    const result = await fetchDailySummaryAction(eodDate)
    if (result.success) {
      setSummary(result.data)
    } else {
      setSummaryError(result.error)
    }
    setSummaryLoading(false)
  }, [eodDate])

  const loadPendingAppts = useCallback(async () => {
    if (!eodDate) return
    setPendingLoading(true)
    const { data } = await supabase
      .from("appointments")
      .select("id, company_name, license_plate, scheduled_time, status, arrival_time")
      .eq("scheduled_date", eodDate)
      .in("status", ["PENDIENTE", "EN_ESPERA"])
      .is("arrival_time", null)
      .order("scheduled_time")
    setPendingAppts((data as Appointment[]) ?? [])
    setPendingLoading(false)
  }, [eodDate, supabase])

  useEffect(() => {
    if (isEODDrawerOpen) {
      setSummary(null)
      setActionError(null)
      setActionSuccess(null)
      setShowConfirm(false)
      loadSummary()
      loadPendingAppts()
    }
  }, [isEODDrawerOpen, loadSummary, loadPendingAppts])

  const allIds = pendingAppts.map(a => a.id)
  const allSelected = allIds.length > 0 && allIds.every(id => eodSelectedIds.has(id))

  const handleSelectAll = () => {
    if (allSelected) { clearEODSelection() } else { selectAllEOD(allIds) }
  }

  const handleConfirmClose = () => {
    setActionError(null)
    setActionSuccess(null)
    startTransition(async () => {
      const result = await markAppointmentsAsNoShowAction({
        appointmentIds: Array.from(eodSelectedIds),
        date: eodDate
      })
      if (result.success) {
        setActionSuccess(result.affected)
        setShowConfirm(false)
        clearEODSelection()
        // Refresh both panels
        await Promise.all([loadSummary(), loadPendingAppts()])
        onSuccess?.()
      } else {
        setActionError(result.error)
        setShowConfirm(false)
      }
    })
  }

  const selectedCount = eodSelectedIds.size
  const formattedDate = eodDate
    ? new Date(eodDate + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : ""

  // Backdrop + drawer slide-in
  if (!isEODDrawerOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={closeEODDrawer}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside className="fixed top-0 right-0 z-50 h-full w-[560px] max-w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container bg-gradient-to-r from-indigo-950 to-indigo-800 text-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-indigo-300">lock_clock</span>
              <h2 className="text-base font-black tracking-tight">Cierre de Jornada</h2>
            </div>
            <p className="text-[11px] text-indigo-300 capitalize mt-0.5">{formattedDate}</p>
          </div>
          <button
            onClick={closeEODDrawer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-300 hover:text-white hover:bg-indigo-700 transition-colors"
            aria-label="Cerrar panel"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Sección A: Dashboard del Día ── */}
          <section className="px-6 py-5 border-b border-surface-container">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">bar_chart</span>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Dashboard del Día</h3>
            </div>

            {summaryLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : summaryError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500">error</span>
                <div>
                  <p className="text-sm font-bold text-red-700">Error al cargar resumen</p>
                  <p className="text-xs text-red-600">{summaryError}</p>
                </div>
                <button onClick={loadSummary} className="ml-auto text-[10px] font-black text-red-700 hover:text-red-900 underline">Reintentar</button>
              </div>
            ) : summary ? (
              <div className="flex flex-col gap-3">
                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <KPICard
                    label="Total Citas"
                    value={summary.total}
                    icon="event"
                    color="default"
                  />
                  <KPICard
                    label="Finalizadas"
                    value={summary.completed}
                    subValue={`de ${summary.total - summary.cancelled}`}
                    icon="check_circle"
                    color="success"
                  />
                  <KPICard
                    label="Incumplidas"
                    value={summary.no_show}
                    icon="person_off"
                    color="danger"
                  />
                  <KPICard
                    label="Cajas Recibidas"
                    value={summary.boxes_received.toLocaleString("es-CO")}
                    subValue={`/ ${summary.boxes_projected.toLocaleString("es-CO")} proyectadas`}
                    icon="inventory_2"
                    color={summary.boxes_missing > 0 ? "warning" : "success"}
                  />
                </div>

                {/* Service Level Bar */}
                <ServiceLevelBar pct={summary.service_level_pct} />

                {/* Average Times */}
                <div className="rounded-xl border bg-surface-container-low border-surface-container p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">timer</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tiempos Promedio</span>
                  </div>
                  <AvgTimeRow label="Espera en Patio"    minutes={summary.avg_wait_patio_min} color="text-amber-600" />
                  <AvgTimeRow label="Posición en Muelle" minutes={summary.avg_wait_dock_min}  color="text-blue-600" />
                  <AvgTimeRow label="Descarga"           minutes={summary.avg_unloading_min}  color="text-indigo-700" />
                </div>

                {/* Boxes missing callout */}
                {summary.boxes_missing > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">warning</span>
                    <p className="text-xs text-amber-800 font-semibold">
                      <span className="font-black">{summary.boxes_missing.toLocaleString("es-CO")}</span> cajas sin recibir según las OCs proyectadas.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          {/* ── Sección B: Gestión de Pendientes ── */}
          <section className="px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">pending_actions</span>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Pendientes de Cierre</h3>
            </div>

            {pendingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : pendingAppts.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-emerald-600 text-[24px]">check_circle</span>
                </div>
                <p className="text-sm font-bold text-on-surface">Todo en orden</p>
                <p className="text-xs text-on-surface-variant mt-1">No hay citas pendientes sin arribo para cerrar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Action feedback */}
                {actionSuccess !== null && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    <p className="text-xs text-emerald-800 font-semibold">{actionSuccess} cita(s) marcadas como INCUMPLIDA correctamente.</p>
                  </div>
                )}
                {actionError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-red-600">error</span>
                    <p className="text-xs text-red-800 font-semibold">{actionError}</p>
                  </div>
                )}

                {/* Table */}
                <div className="rounded-xl border border-surface-container overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <th className="pl-4 pr-2 py-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-surface-container-high accent-red-600 cursor-pointer"
                            title="Seleccionar todo"
                          />
                        </th>
                        <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">ID</th>
                        <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Empresa</th>
                        <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Placa</th>
                        <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Hora</th>
                        <th className="px-2 pr-4 py-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container/50">
                      {pendingAppts.map(appt => (
                        <PendingRow
                          key={appt.id}
                          appt={appt}
                          selected={eodSelectedIds.has(appt.id)}
                          onToggle={toggleEODSelection}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Selection count hint */}
                {selectedCount > 0 && (
                  <p className="text-[11px] text-on-surface-variant text-right">
                    <span className="font-black text-red-700">{selectedCount}</span> cita(s) seleccionada(s)
                  </p>
                )}

                {/* Confirmation Inline Step */}
                {showConfirm ? (
                  <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-red-600 text-[18px] mt-0.5">warning</span>
                      <div>
                        <p className="text-sm font-black text-red-800">¿Confirmar cierre masivo?</p>
                        <p className="text-xs text-red-700 mt-1">
                          Se marcarán <span className="font-black">{selectedCount}</span> citas como <span className="font-black">INCUMPLIDA</span>. Esta acción generará registros de auditoría y no puede deshacerse.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowConfirm(false)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-surface-container hover:bg-surface-container transition-colors"
                        disabled={isPending}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmClose}
                        disabled={isPending}
                        className="px-4 py-1.5 text-xs font-black rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {isPending && <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>}
                        {isPending ? "Procesando..." : "Confirmar Cierre"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={selectedCount === 0 || isPending}
                    onClick={() => setShowConfirm(true)}
                    className={cn(
                      "w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all",
                      selectedCount > 0
                        ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
                        : "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">person_off</span>
                    Marcar como Incumplidas
                    {selectedCount > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[11px]">({selectedCount})</span>}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
