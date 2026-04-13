"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Environment } from "@/types"

interface CapacitySummary {
  environment: Environment
  normalLimit: number
  extendedLimit: number
  currentBoxes: number
  appointmentCount: number
  extendedStartTime?: string
  extendedEndTime?: string
}

export default function ResumenDiarioPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [summaries, setSummaries] = useState<CapacitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [totalBoxes, setTotalBoxes] = useState(0)
  const [totalAppointments, setTotalAppointments] = useState(0)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // Fetch environments, capacity limits, and appointments in parallel
    const [envRes, capRes, apptRes] = await Promise.all([
      supabase.from('environments').select('*').eq('is_active', true).order('id'),
      supabase.from('daily_capacity_limits').select('*').eq('is_active', true),
      supabase.from('appointments').select('id, box_count, environment_id, status, requires_extended_hours, is_forced_assignment, appointment_purchase_orders(box_count)')
        .eq('scheduled_date', date)
        .neq('status', 'CANCELADO'),
    ])

    const environments = envRes.data || []
    const capacityLimits = capRes.data || []
    const appointments = apptRes.data || []

    let grandTotalBoxes = 0
    let grandTotalAppts = 0

    const results: CapacitySummary[] = environments.map((env) => {
      const limit = capacityLimits.find(c => c.environment_id === env.id)
      const envAppts = appointments.filter(a => a.environment_id === env.id)
      
      const envBoxes = envAppts.reduce((total, appt) => {
        const poBoxes = appt.appointment_purchase_orders?.reduce(
          (s: number, po: { box_count: number }) => s + (po.box_count || 0), 0
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
        extendedStartTime: limit?.extended_start_time,
        extendedEndTime: limit?.extended_end_time,
      }
    })

    // Include unassigned appointments (no environment_id)
    const unassignedAppts = appointments.filter(a => !a.environment_id)
    const unassignedBoxes = unassignedAppts.reduce((total, appt) => {
      const poBoxes = appt.appointment_purchase_orders?.reduce(
        (s: number, po: { box_count: number }) => s + (po.box_count || 0), 0
      ) || 0
      return total + (poBoxes || appt.box_count || 0)
    }, 0)
    grandTotalBoxes += unassignedBoxes
    grandTotalAppts += unassignedAppts.length

    setTotalBoxes(grandTotalBoxes)
    setTotalAppointments(grandTotalAppts)
    setSummaries(results)
    setLoading(false)
  }, [supabase, date])

  useEffect(() => { fetchData() }, [fetchData])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('resumen-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchData])

  const getPercentage = (current: number, limit: number) => limit > 0 ? Math.round((current / limit) * 100) : 0
  
  const getBarColor = (current: number, normalLimit: number, extendedLimit: number) => {
    if (normalLimit === 0) return 'bg-surface-container'
    if (current > extendedLimit) return 'bg-error' // Over extended = critical
    if (current > normalLimit) return 'bg-amber-500' // Over normal = warning
    if (current > normalLimit * 0.8) return 'bg-yellow-400' // 80%+ = caution
    return 'bg-tertiary' // Healthy
  }

  const getStatusLabel = (current: number, normalLimit: number, extendedLimit: number) => {
    if (normalLimit === 0) return { text: 'Sin Configurar', color: 'text-on-surface-variant/40' }
    if (current > extendedLimit) return { text: '🔴 SOBRECUPO CRÍTICO', color: 'text-error font-black' }
    if (current > normalLimit) return { text: '🟡 HORARIO EXTENDIDO', color: 'text-amber-600 font-bold' }
    if (current > normalLimit * 0.8) return { text: '🟠 ACERCÁNDOSE AL LÍMITE', color: 'text-yellow-600 font-bold' }
    return { text: '🟢 DENTRO DE CAPACIDAD', color: 'text-tertiary font-bold' }
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-[0.3em] text-primary/60 uppercase">Control de Capacidad</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">RESUMEN DIARIO</h1>
          <p className="text-sm text-on-surface-variant/60 font-medium capitalize">{dateLabel}</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Stats */}
          <Card className="px-5 py-3 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">inventory_2</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Total Cajas</p>
              <p className="text-xl font-black font-headline leading-none">{totalBoxes.toLocaleString()}</p>
            </div>
          </Card>
          <Card className="px-5 py-3 flex items-center gap-4 bg-white/50 border-none shadow-ambient">
            <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary">local_shipping</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Citas</p>
              <p className="text-xl font-black font-headline leading-none">{totalAppointments}</p>
            </div>
          </Card>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]) }}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-[180px] text-center font-bold"
            />
            <button 
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]) }}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Capacity Bars */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse bg-surface-container rounded-2xl" />
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <Card variant="elevated" className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-primary/20 mb-4">monitoring</span>
          <h3 className="text-xl font-black font-headline text-on-surface/60">Sin Ambientes Configurados</h3>
          <p className="text-sm text-on-surface-variant/50 mt-2 max-w-sm mx-auto">Configura ambientes y límites de capacidad en Configuración CEDI para ver el resumen.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {summaries.map((s) => {
            const normalPct = getPercentage(s.currentBoxes, s.normalLimit)
            const barColor = getBarColor(s.currentBoxes, s.normalLimit, s.extendedLimit)
            const status = getStatusLabel(s.currentBoxes, s.normalLimit, s.extendedLimit)
            const barWidth = s.extendedLimit > 0 ? Math.min((s.currentBoxes / s.extendedLimit) * 100, 100) : 0
            const normalMarker = s.extendedLimit > 0 ? (s.normalLimit / s.extendedLimit) * 100 : 50

            return (
              <Card key={s.environment.id} variant="elevated" className="p-6 space-y-4 overflow-hidden relative">
                {/* Over-capacity pulsing glow */}
                {s.currentBoxes > s.extendedLimit && (
                  <div className="absolute inset-0 bg-error/5 animate-pulse pointer-events-none" />
                )}

                {/* Header Row */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.environment.color + '20' }}>
                      <span className="material-symbols-outlined text-xl" style={{ color: s.environment.color }}>{s.environment.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-black font-headline text-lg text-on-surface">{s.environment.display_name}</h3>
                      <p className={`text-[10px] uppercase tracking-wider ${status.color}`}>{status.text}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black font-headline text-on-surface leading-none">{s.currentBoxes.toLocaleString()}</p>
                    <p className="text-[10px] text-on-surface-variant/50 font-bold mt-1">
                      de {s.normalLimit.toLocaleString()} normal / {s.extendedLimit.toLocaleString()} ext.
                    </p>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="relative z-10">
                  <div className="h-4 bg-surface-container rounded-full relative overflow-hidden">
                    {/* Filled portion */}
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${s.currentBoxes > s.extendedLimit ? 'animate-pulse' : ''}`}
                      style={{ width: `${barWidth}%` }}
                    />
                    {/* Normal limit marker */}
                    {s.normalLimit > 0 && (
                      <div 
                        className="absolute top-0 h-full w-0.5 bg-on-surface/30"
                        style={{ left: `${normalMarker}%` }}
                      />
                    )}
                  </div>
                  {/* Labels under bar */}
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] font-bold text-on-surface-variant/40">0</span>
                    {s.normalLimit > 0 && (
                      <span className="text-[9px] font-bold text-on-surface-variant/60" style={{ marginLeft: `${normalMarker - 5}%` }}>
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
                    <span className="material-symbols-outlined text-sm text-on-surface-variant/40">local_shipping</span>
                    <span className="text-xs font-bold">{s.appointmentCount} citas</span>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant/40">percent</span>
                    <span className="text-xs font-bold">{normalPct}% del normal</span>
                  </div>
                  {s.extendedStartTime && (
                    <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant/40">schedule</span>
                      <span className="text-xs font-bold">Ext: {s.extendedStartTime?.substring(0,5)} – {s.extendedEndTime?.substring(0,5)}</span>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Footer Tip */}
      <p className="text-center text-[10px] text-on-surface-variant/30 font-bold uppercase tracking-widest">
        Datos en tiempo real · Selecciona una fecha para consultar cualquier día
      </p>
    </div>
  )
}
