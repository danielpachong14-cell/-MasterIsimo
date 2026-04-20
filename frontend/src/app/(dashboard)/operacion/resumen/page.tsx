// Server Component — sin "use client"
// El fetch de datos se ejecuta en el servidor en cada request con el parámetro fecha.
// Solo el selector de fecha (ResumenShell) es Client Component.

import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { ResumenShell } from "./components/ResumenShell"
import type { Environment } from "@/types"

interface CapacitySummary {
  environment: Environment
  normalLimit: number
  extendedLimit: number
  currentBoxes: number
  appointmentCount: number
  extendedStartTime?: string
  extendedEndTime?: string
}

// ─── Helpers de presentación (funciones puras, sin I/O) ───────

function getPercentage(current: number, limit: number): number {
  return limit > 0 ? Math.round((current / limit) * 100) : 0
}

function getBarColor(current: number, normalLimit: number, extendedLimit: number): string {
  if (normalLimit === 0) return "bg-surface-container"
  if (current > extendedLimit) return "bg-error"
  if (current > normalLimit) return "bg-amber-500"
  if (current > normalLimit * 0.8) return "bg-yellow-400"
  return "bg-tertiary"
}

function getStatusLabel(
  current: number,
  normalLimit: number,
  extendedLimit: number
): { text: string; color: string } {
  if (normalLimit === 0) return { text: "Sin Configurar", color: "text-on-surface-variant/40" }
  if (current > extendedLimit) return { text: "🔴 SOBRECUPO CRÍTICO", color: "text-error font-black" }
  if (current > normalLimit) return { text: "🟡 HORARIO EXTENDIDO", color: "text-amber-600 font-bold" }
  if (current > normalLimit * 0.8)
    return { text: "🟠 ACERCÁNDOSE AL LÍMITE", color: "text-yellow-600 font-bold" }
  return { text: "🟢 DENTRO DE CAPACIDAD", color: "text-tertiary font-bold" }
}

// ─── Server-side data fetching ────────────────────────────────

async function fetchResumenData(date: string): Promise<{
  summaries: CapacitySummary[]
  totalBoxes: number
  totalAppointments: number
}> {
  const supabase = await createClient()

  // Queries en paralelo: tipos de carga, límites, y citas del día (campos mínimos)
  const [envRes, capRes, apptRes] = await Promise.all([
    supabase.from("environments").select("id, name, display_name, color, icon, is_active").eq("is_active", true).order("id"),
    supabase.from("daily_capacity_limits").select("environment_id, normal_box_limit, extended_box_limit, extended_start_time, extended_end_time, is_active").eq("is_active", true),
    supabase
      .from("appointments")
      .select("id, box_count, environment_id, appointment_purchase_orders(box_count)")
      .eq("scheduled_date", date)
      .neq("status", "CANCELADO"),
  ])

  const environments = (envRes.data ?? []) as Environment[]
  const capacityLimits = capRes.data ?? []
  const appointments = apptRes.data ?? []

  let grandTotalBoxes = 0
  let grandTotalAppts = 0

  const summaries: CapacitySummary[] = environments.map((env) => {
    const limit = capacityLimits.find((c) => c.environment_id === env.id)
    const envAppts = appointments.filter((a) => a.environment_id === env.id)

    const envBoxes = envAppts.reduce((total, appt) => {
      const poBoxes =
        appt.appointment_purchase_orders?.reduce(
          (s: number, po: { box_count: number }) => s + (po.box_count || 0),
          0
        ) || 0
      return total + (poBoxes || appt.box_count || 0)
    }, 0)

    grandTotalBoxes += envBoxes
    grandTotalAppts += envAppts.length

    return {
      environment: env,
      normalLimit: limit?.normal_box_limit || 0,
      extendedLimit: limit?.extended_box_limit || 0,
      currentBoxes: envBoxes,
      appointmentCount: envAppts.length,
      extendedStartTime: limit?.extended_start_time ?? undefined,
      extendedEndTime: limit?.extended_end_time ?? undefined,
    }
  })

  // Citas sin tipo de carga asignado
  const unassignedAppts = appointments.filter((a) => !a.environment_id)
  const unassignedBoxes = unassignedAppts.reduce((total, appt) => {
    const poBoxes =
      appt.appointment_purchase_orders?.reduce(
        (s: number, po: { box_count: number }) => s + (po.box_count || 0),
        0
      ) || 0
    return total + (poBoxes || appt.box_count || 0)
  }, 0)
  grandTotalBoxes += unassignedBoxes
  grandTotalAppts += unassignedAppts.length

  return { summaries, totalBoxes: grandTotalBoxes, totalAppointments: grandTotalAppts }
}

// ─── Page (Server Component) ──────────────────────────────────

interface ResumenPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function ResumenDiarioPage({ searchParams }: ResumenPageProps) {
  const params = await searchParams
  const date = params.date ?? new Date().toISOString().split("T")[0]

  // Fetch en el servidor: sin latencia de hydration, sin useEffect, sin loading spinner inicial
  const { summaries, totalBoxes, totalAppointments } = await fetchResumenData(date)

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">
            Control de Capacidad por Tipo de Carga
          </p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">
            RESUMEN DIARIO
          </h1>
          <p className="text-sm text-on-surface-variant/60 font-medium capitalize">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats (rendereadas en servidor — sin loading state) */}
          <Card className="px-5 py-3 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">inventory_2</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">
                Total Cajas
              </p>
              <p className="text-xl font-black font-headline leading-none">
                {totalBoxes.toLocaleString()}
              </p>
            </div>
          </Card>
          <Card className="px-5 py-3 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary">local_shipping</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">
                Citas
              </p>
              <p className="text-xl font-black font-headline leading-none">{totalAppointments}</p>
            </div>
          </Card>

          {/* Date Picker: único Client Component de la página */}
          <ResumenShell currentDate={date} />
        </div>
      </div>

      {/* Capacity Bars */}
      {summaries.length === 0 ? (
        <Card variant="elevated" className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-primary/20 mb-4">monitoring</span>
          <h3 className="text-xl font-black font-headline text-on-surface/60">
            Sin Tipos de Carga Configurados
          </h3>
          <p className="text-sm text-on-surface-variant/50 mt-2 max-w-sm mx-auto">
            Configura tipos de carga y límites de capacidad en Configuración CEDI para ver el resumen.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {summaries.map((s) => {
            const normalPct = getPercentage(s.currentBoxes, s.normalLimit)
            const barColor = getBarColor(s.currentBoxes, s.normalLimit, s.extendedLimit)
            const status = getStatusLabel(s.currentBoxes, s.normalLimit, s.extendedLimit)
            const barWidth =
              s.extendedLimit > 0
                ? Math.min((s.currentBoxes / s.extendedLimit) * 100, 100)
                : 0
            const normalMarker =
              s.extendedLimit > 0 ? (s.normalLimit / s.extendedLimit) * 100 : 50

            return (
              <Card key={s.environment.id} variant="elevated" className="p-6 space-y-4 overflow-hidden relative">
                {/* Over-capacity pulsing glow */}
                {s.currentBoxes > s.extendedLimit && (
                  <div className="absolute inset-0 bg-error/5 animate-pulse pointer-events-none" />
                )}

                {/* Header Row */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: s.environment.color + "20" }}
                    >
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{ color: s.environment.color }}
                      >
                        {s.environment.icon}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-black font-headline text-lg text-on-surface">
                        {s.environment.display_name}
                      </h3>
                      <p className={`text-[10px] uppercase tracking-wider ${status.color}`}>
                        {status.text}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black font-headline text-on-surface leading-none">
                      {s.currentBoxes.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-on-surface-variant/50 font-bold mt-1">
                      de {s.normalLimit.toLocaleString()} normal / {s.extendedLimit.toLocaleString()} ext.
                    </p>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="relative z-10">
                  <div className="h-4 bg-surface-container rounded-full relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${
                        s.currentBoxes > s.extendedLimit ? "animate-pulse" : ""
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                    {s.normalLimit > 0 && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-on-surface/30"
                        style={{ left: `${normalMarker}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] font-bold text-on-surface-variant/40">0</span>
                    {s.normalLimit > 0 && (
                      <span
                        className="text-[9px] font-bold text-on-surface-variant/60"
                        style={{ marginLeft: `${normalMarker - 5}%` }}
                      >
                        Normal: {s.normalLimit.toLocaleString()}
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-on-surface-variant/40">
                      Ext: {s.extendedLimit.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex gap-4 relative z-10">
                  <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant/40">
                      local_shipping
                    </span>
                    <span className="text-xs font-bold">{s.appointmentCount} citas</span>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant/40">
                      percent
                    </span>
                    <span className="text-xs font-bold">{normalPct}% del normal</span>
                  </div>
                  {s.extendedStartTime && (
                    <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant/40">
                        schedule
                      </span>
                      <span className="text-xs font-bold">
                        Ext: {s.extendedStartTime?.substring(0, 5)} –{" "}
                        {s.extendedEndTime?.substring(0, 5)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-on-surface-variant/30 font-bold uppercase tracking-widest">
        Datos del servidor · Selecciona una fecha para consultar cualquier día
      </p>
    </div>
  )
}
