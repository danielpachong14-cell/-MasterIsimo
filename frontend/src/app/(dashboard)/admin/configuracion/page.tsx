"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Environment, 
  DailyCapacityLimit, 
  SchedulingRule, 
  VehicleType, 
  Dock 
} from "@/types"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { cn, capitalize, normalizeObjectForStorage } from "@/lib/utils"

const LOGISTICS_ICONS = [
  // LOGÍSTICA
  'warehouse', 'inventory_2', 'pallet', 'forklift', 
  'local_shipping', 'shelves', 'conveyor_belt', 'trolley', 
  'package_2', 'barcode_scanner', 'factory', 'delivery_dining',
  // TEMPERATURA / TIPO DE CARGA
  'ac_unit', 'hvac', 'water_drop', 'thermostat', 'kitchen', 
  'severe_cold', 'cyclone', 'science',
  // HARD DISCOUNT / COMIDA
  'grocery', 'nutrition', 'bakery_dining', 'egg', 
  'set_meal', 'cookie', 'coffee', 'local_drink', 
  'liquor', 'wine_bar', 'icecream', 'lunch_dining',
  'restaurant', 'flatware', 'outdoor_grill', 'cleaning_services',
  'soap', 'sanitizer', 'stroller', 'emoji_objects'
];

const PRIORITY_LEVELS = [
  { value: 1, label: 'Nivel 1: Mínima (Base)', color: 'text-slate-500 bg-slate-50' },
  { value: 2, label: 'Nivel 2: Baja', color: 'text-blue-500 bg-blue-50' },
  { value: 3, label: 'Nivel 3: Regular', color: 'text-cyan-500 bg-cyan-50' },
  { value: 4, label: 'Nivel 4: Normal', color: 'text-green-500 bg-green-50' },
  { value: 5, label: 'Nivel 5: Elevada', color: 'text-amber-500 bg-amber-50' },
  { value: 6, label: 'Nivel 6: Urgente', color: 'text-orange-500 bg-orange-50' },
  { value: 7, label: 'Nivel 7: Crítica (Máxima)', color: 'text-rose-500 bg-rose-50' },
];

export default function ConfiguracionPage() {
  // --- ESTADO DE DATOS ---
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [limits, setLimits] = useState<DailyCapacityLimit[]>([])
  const [rules, setRules] = useState<SchedulingRule[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cediSettings, setCediSettings] = useState<any>(null)
  
  // --- ESTADOS DE CARGA ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // --- ESTADO DE MODALES Y EDICIÓN ---
  const [activeModal, setActiveModal] = useState<'env' | 'limit' | 'rule' | 'vehicle' | 'dock' | 'cedi' | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingItem, setEditingItem] = useState<any>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [envRes, limitRes, ruleRes, vehRes, dockRes, cediRes] = await Promise.all([
        supabase.from('environments').select('*'),
        supabase.from('daily_capacity_limits').select('*, environment:environments(*)'),
        supabase.from('scheduling_rules').select('*, environment:environments(*), vehicle_type:vehicle_types(*)').order('priority', { ascending: true }),
        supabase.from('vehicle_types').select('*'),
        supabase.from('docks').select('*, environment:environments(*)').order('name'),
        supabase.from('cedi_settings').select('*').single()
      ])

      if (envRes.data) setEnvironments(envRes.data)
      if (limitRes.data) setLimits(limitRes.data)
      if (ruleRes.data) setRules(ruleRes.data)
      if (vehRes.data) setVehicleTypes(vehRes.data)
      if (dockRes.data) setDocks(dockRes.data)
      if (cediRes.data) setCediSettings(cediRes.data)
    } catch (error) {
      console.error("Error fetching configuration:", error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- HANDLERS GENÉRICOS ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSave = async (table: string, data: any) => {
    setSaving(true)
    try {
      // 1. Limpieza profunda del payload
      // Extraemos relaciones y campos automáticos que fallarían en un 'upsert'
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { environment, vehicle_type, created_at, updated_at, ...cleanPayload } = data
      
      // 2. Manejo de ID y campos por defecto y estandarización dinámica
      const payload = normalizeObjectForStorage({ ...cleanPayload })
      
      if (!payload.id) {
        delete payload.id // Asegurar que sea autoincremental si no existe
        if (table !== 'scheduling_rules') { // La mayoría de tablas maestras usan is_active
          payload.is_active = true
        }
      }

      console.group(`Saving to ${table}`)
      console.log("Payload:", payload)
      
      const { error, data: savedData } = await supabase.from(table).upsert(payload).select().single()
      
      if (error) {
        console.error("Supabase Error:", error)
        throw new Error(error.message || "Error desconocido en la base de datos")
      }
      
      console.log("Saved successfully:", savedData)
      console.groupEnd()
      
      setActiveModal(null)
      setEditingItem(null)
      fetchData()
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.groupEnd()
      alert(`⚠️ Problema al guardar en ${table}:\n${error.message || error}`)
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (table: string, id: string | number, logical: boolean = true) => {
    const action = logical ? "descactivar" : "eliminar permanentemente"
    if (!confirm(`¿Estás seguro de que deseas ${action} este registro?`)) return
    
    try {
      const { error } = logical 
        ? await supabase.from(table).update({ is_active: false }).eq('id', id)
        : await supabase.from(table).delete().eq('id', id)
      
      if (error) {
        // Manejo amigable de restricciones de integridad referencial
        if (error.code === '23503') {
          alert("⚠️ No se puede eliminar por completo porque está siendo usado por otros registros. Se procederá a desactivarlo para mantener la integridad.")
          await supabase.from(table).update({ is_active: false }).eq('id', id)
        } else {
          throw error
        }
      }
      fetchData()
    } catch (e: unknown) {
      console.error(e)
      const error = e as Error
      alert(`Error al procesar acción en ${table}: ${error.message || 'Error desconocido'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-32 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex items-end justify-between border-b border-outline-variant/30 pb-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-black font-headline tracking-tighter text-on-surface">Configuración Maestra</h1>
          <p className="text-on-surface-variant font-medium text-lg leading-relaxed max-w-2xl">
            Control de infraestructura, parámetros de vehículos y reglas de lógica operativa del CEDI.
          </p>
        </div>
      </div>

      {/* --- BLOQUE 0: AJUSTES GLOBALES (HORARIO) --- */}
      <section className="bg-gradient-to-r from-primary-container/20 to-transparent p-6 rounded-[2rem] border border-primary-container/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center text-on-primary shadow-xl shadow-primary/20">
            <span className="material-symbols-outlined text-3xl">schedule</span>
          </div>
          <div>
            <h2 className="text-3xl font-black font-headline text-on-surface">Horario de Operación</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-success/10 text-success text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Activo</span>
              <p className="text-on-surface-variant font-bold text-lg">
                Se aceptan citas de <span className="text-primary font-black underline decoration-2 underline-offset-4">{cediSettings?.start_time.substring(0, 5)}</span> a <span className="text-primary font-black underline decoration-2 underline-offset-4">{cediSettings?.end_time.substring(0, 5)}</span>
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => { setEditingItem(cediSettings); setActiveModal('cedi') }} className="px-10 h-14 rounded-2xl shadow-lg shadow-primary/20 gap-3 group">
          <span className="material-symbols-outlined transition-transform group-hover:rotate-180">settings</span>
          Modificar Horario
        </Button>
      </section>

      {/* --- BLOQUE 1: INFRAESTRUCTURA (TIPOS DE CARGA Y MUELLES) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECCIÓN: TIPOS DE CARGA OPERATIVOS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined text-2xl">warehouse</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Tipos de Carga</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Zonas del CEDI</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('env') }} variant="secondary" size="sm" className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nuevo
            </Button>
          </div>
          
          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <div className="h-[400px] overflow-y-auto p-5 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {environments.map(env => (
                  <Card key={env.id} className={cn(
                    "p-5 border-white/50 bg-white/40 backdrop-blur-md group hover:shadow-lg transition-all border",
                    !env.is_active && "opacity-60 grayscale-[0.4]"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110",
                        env.name === 'Secos' ? "bg-amber-500" : 
                        env.name === 'Fríos' ? "bg-blue-500" : "bg-purple-500"
                      )}>
                        <span className="material-symbols-outlined text-xl">{env.icon}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(env); setActiveModal('env') }} className="p-1.5 hover:bg-primary/10 text-primary rounded-lg">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => handleDelete('environments', env.id, false)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    <h3 className="text-lg font-black font-headline truncate">{capitalize(env.display_name)}</h3>
                    <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">{env.name}</p>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* SECCIÓN: MUELLES / DOCKS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                <span className="material-symbols-outlined text-2xl">dock</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Muelles</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Capacidad de Atraque</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('dock') }} variant="secondary" size="sm" className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Añadir Muelle
            </Button>
          </div>
          
          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <div className="h-[400px] overflow-y-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-lowest sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Nombre</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Tipo de Carga</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Tipo / Estado</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {docks.map(dock => (
                    <tr key={dock.id} className={cn(
                      "hover:bg-surface-container-lowest transition-all group",
                      (!dock.is_active || dock.type === 'CARGUE') && "opacity-60 grayscale-[0.4]"
                    )}>
                      <td className="px-5 py-3 font-bold text-sm">{capitalize(dock.name)}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                          dock.environment?.name === 'secos' ? "bg-amber-100 text-amber-700" : 
                          dock.environment?.name === 'fríos' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {capitalize(dock.environment?.display_name) || 'Sin Asignar'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded w-fit",
                            dock.type === 'DESCARGUE' ? "bg-green-100 text-green-700" :
                            dock.type === 'CARGUE' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          )}>
                            {dock.type}
                          </span>
                          {dock.type === 'MIXTO' ? (
                            <span className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded w-fit",
                              dock.is_unloading_authorized ? "bg-success/10 text-success" : "bg-error/10 text-error"
                            )}>
                              {dock.is_unloading_authorized ? 'AUTORIZADO DESCARGA' : 'SOLO CARGUE'}
                            </span>
                          ) : dock.type === 'CARGUE' ? (
                            <span className="text-[8px] font-bold text-amber-600/60 italic tracking-tight">Bloqueado para Citas</span>
                          ) : null}
                          {!dock.is_active && (
                            <span className="text-[8px] font-black bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded w-fit">
                              INACTIVO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingItem(dock); setActiveModal('dock') }} className="p-1.5 hover:bg-primary/10 text-primary rounded-lg">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => handleDelete('docks', dock.id, false)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      {/* --- BLOQUE 2: PARÁMETROS MAESTROS (VEHÍCULOS) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECCIÓN: TIPOS DE VEHÍCULOS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600 shadow-sm">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Vehículos</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Base de Cálculo</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('vehicle') }} variant="secondary" size="sm" className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nuevo Tipo
            </Button>
          </div>
          
          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <div className="h-[400px] overflow-y-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-lowest sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Nombre</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Cajas Base</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Tiempo</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right"></th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {vehicleTypes.map(v => (
                  <tr key={v.id} className={cn(
                    "hover:bg-surface-container-lowest transition-colors group",
                    !v.is_active && "opacity-60 grayscale-[0.4]"
                  )}>
                    <td className="px-5 py-3 font-bold text-sm text-on-surface">{capitalize(v.name)}</td>
                    <td className="px-5 py-3 text-sm font-black">{v.base_boxes} <span className="text-[9px] font-bold text-on-surface-variant">CAJAS</span></td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">{v.base_time_minutes} min <span className="text-[8px] opacity-50 uppercase tracking-tighter">Base</span></span>
                        <span className="text-xs font-bold text-amber-600">+{v.maneuver_time_minutes} min <span className="text-[8px] opacity-50 uppercase tracking-tighter">Maniobra</span></span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(v); setActiveModal('vehicle') }} className="p-1.5 hover:bg-primary/10 text-primary rounded-lg">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => handleDelete('vehicle_types', v.id, false)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      {/* --- BLOQUE 3: LÓGICA DE NEGOCIO (CAPACIDADES Y REGLAS) --- */}
      <div className="space-y-12">
        
        {/* SECCIÓN: SOFT LIMITS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                <span className="material-symbols-outlined text-2xl">speed</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Capacidad Diaria</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Alertas de Saturación</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('limit') }} variant="secondary" size="sm" className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Ajustar Límite
            </Button>
          </div>

          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <div className="h-[400px] overflow-y-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-lowest sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Tipo de Carga</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Límite Normal</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Límite Extendido</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Horario Ext.</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right"></th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {limits.map(limit => (
                  <tr key={limit.id} className={cn(
                    "hover:bg-surface-container-lowest transition-colors group",
                    !limit.is_active && "opacity-60 grayscale-[0.4]"
                  )}>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                        limit.environment?.name === 'Secos' ? "bg-amber-100 text-amber-700" : 
                        limit.environment?.name === 'Fríos' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      )}>
                        {capitalize(limit.environment?.display_name)}
                      </span>
                    </td>
                    <td className="px-6 py-4"><span className="text-lg font-black">{limit.normal_box_limit.toLocaleString()}</span> <span className="text-[10px] font-bold text-on-surface-variant uppercase">cajas</span></td>
                    <td className="px-6 py-4 font-black text-on-surface/40 group-hover:text-on-surface transition-colors">{limit.extended_box_limit.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="bg-surface-container-high px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
                        {limit.extended_start_time?.substring(0, 5)} — {limit.extended_end_time?.substring(0, 5)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(limit); setActiveModal('limit') }} className="p-2 hover:bg-primary/10 text-primary rounded-lg">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete('daily_capacity_limits', limit.id, false)} className="p-2 hover:bg-error-container hover:text-error rounded-lg">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </section>

        {/* SECCIÓN: REGLAS DE SCHEDULING (EL MOTOR) */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                <span className="material-symbols-outlined text-2xl">rule</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Motor de Scheduling</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Lógica en Cascada</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({ priority: rules.length * 10 }); setActiveModal('rule') }} variant="secondary" className="gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              Nueva Regla
            </Button>
          </div>

          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <div className="h-[500px] overflow-y-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-lowest sticky top-0 z-10 transition-colors">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">P</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Tipo de Carga</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Vehículo</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Rango Cajas</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Duración</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right"></th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      {(() => {
                        const p = PRIORITY_LEVELS.find(l => l.value === rule.priority);
                        return (
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[9px] font-black border tracking-tight block w-fit whitespace-nowrap",
                            p?.color || "text-on-surface-variant bg-surface-container"
                          )}>
                            {p?.label.split(':')[1]?.trim().toUpperCase() || `P${rule.priority}`}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 font-bold text-sm text-on-surface">{capitalize(rule.name)}</td>
                    <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">{capitalize(rule.environment?.display_name) || 'Todos'}</td>
                    <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">{capitalize(rule.vehicle_type?.name) || 'Todos'}</td>
                    <td className="px-6 py-4 font-mono font-bold text-xs">{rule.min_boxes} — {rule.max_boxes || '∞'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-black border w-fit",
                            rule.is_dynamic ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-green-50 text-green-700 border-green-200"
                          )}>
                            {rule.is_dynamic 
                              ? (rule.max_duration_minutes ? `${rule.duration_minutes} — ${rule.max_duration_minutes} min` : 'DINÁMICO')
                              : `${rule.duration_minutes} min`
                            }
                          </span>
                          {rule.is_dynamic && !rule.max_duration_minutes && rule.efficiency_multiplier !== 1 && (
                            <span className="text-[9px] font-bold text-purple-400 italic">Factor: {rule.efficiency_multiplier}x</span>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(rule); setActiveModal('rule') }} className="p-2 hover:bg-primary/10 text-primary rounded-lg">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete('scheduling_rules', rule.id, false)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </section>
      </div>

      {/* MODAL HORARIO CEDI */}
      {activeModal === 'cedi' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-sm p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Horario de Operación</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('cedi_settings', editingItem) }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Hora de Inicio</label>
                  <Input type="time" value={editingItem.start_time || ''} onChange={e => setEditingItem({...editingItem, start_time: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Hora de Cierre</label>
                  <Input type="time" value={editingItem.end_time || ''} onChange={e => setEditingItem({...editingItem, end_time: e.target.value})} required />
                </div>
              </div>
              <p className="text-[11px] text-on-surface-variant bg-surface-container-low p-3 rounded-lg leading-relaxed">
                <span className="font-black text-primary">Nota:</span> Estos horarios definen el rango de disponibilidad global para el motor de agendamiento.
              </p>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 shadow-lg" disabled={saving}>Confirmar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL VEHÍCULO */}
      {activeModal === 'vehicle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Tipo de Vehículo</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('vehicle_types', editingItem) }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Nombre Comercial</label>
                <Input value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="Ej: Tractomula, Turbo, Van..." required />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Capacidad Base (Cajas)</label>
                  <Input type="number" value={editingItem.base_boxes || ''} onChange={e => setEditingItem({...editingItem, base_boxes: Number(e.target.value)})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant">Tiempo Base (Min)</label>
                    <Input type="number" value={editingItem.base_time_minutes || ''} onChange={e => setEditingItem({...editingItem, base_time_minutes: Number(e.target.value)})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant">Maniobra (Min)</label>
                    <Input type="number" value={editingItem.maneuver_time_minutes || ''} onChange={e => setEditingItem({...editingItem, maneuver_time_minutes: Number(e.target.value)})} required />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-green-600" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL MUELLE */}
      {activeModal === 'dock' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Configurar Muelle</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('docks', editingItem) }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Nombre / Identificador</label>
                <Input value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="Ej: B-01, Muelle 5..." required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Tipo de Carga</label>
                <select 
                  className="w-full bg-surface-container rounded-xl px-4 h-12 text-sm font-bold border-0"
                  value={editingItem.environment_id || ''}
                  onChange={e => setEditingItem({...editingItem, environment_id: Number(e.target.value)})}
                  required
                >
                  <option value="">Seleccionar Tipo de Carga...</option>
                  {environments.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Tipo de Muelle</label>
                  <select 
                    className="w-full bg-surface-container rounded-xl px-4 h-12 text-sm font-bold border-0"
                    value={editingItem.type || 'DESCARGUE'}
                    onChange={e => {
                      const newType = e.target.value;
                      setEditingItem({
                        ...editingItem, 
                        type: newType,
                        // Mejora: Si se configura en CARGUE, se desactiva automáticamente para agendamiento (descarga)
                        // y se marca como inactivo (escondido) de las vistas de descargue
                        is_active: newType === 'CARGUE' ? false : editingItem.is_active,
                        is_unloading_authorized: newType === 'CARGUE' ? false : editingItem.is_unloading_authorized
                      });
                    }}
                    required
                  >
                    <option value="DESCARGUE">Descargue</option>
                    <option value="CARGUE">Cargue</option>
                    <option value="MIXTO">Mixto</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Estado</label>
                  <select 
                    className={cn(
                      "w-full bg-surface-container rounded-xl px-4 h-12 text-sm font-bold border-0 transition-opacity",
                      editingItem.type === 'CARGUE' && "opacity-50 cursor-not-allowed"
                    )}
                    value={editingItem.is_active !== undefined ? String(editingItem.is_active) : 'true'}
                    onChange={e => setEditingItem({...editingItem, is_active: e.target.value === 'true'})}
                    disabled={editingItem.type === 'CARGUE'}
                  >
                    <option value="true">Habilitado</option>
                    <option value="false">Deshabilitado</option>
                  </select>
                  {editingItem.type === 'CARGUE' && (
                    <p className="text-[9px] font-bold text-amber-600 px-1">Bloqueado: Muelles de Cargue no son visibles para Descarga</p>
                  )}
                </div>
              </div>

              {editingItem.type === 'MIXTO' && (
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <p className="text-xs font-black text-purple-900">Autorización de Descarga</p>
                    <p className="text-[10px] text-purple-700">Permitir agendar citas de descarga en este muelle.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setEditingItem({...editingItem, is_unloading_authorized: !editingItem.is_unloading_authorized})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      editingItem.is_unloading_authorized ? "bg-purple-600" : "bg-outline-variant"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                      editingItem.is_unloading_authorized ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Descripción (Opcional)</label>
                <Input value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} placeholder="Detalles de ubicación o tipo..." />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-indigo-600 text-white" disabled={saving}>Guardar Muelle</Button>
              </div>
            </form>
          </Card>
        </div>
      )}


      {activeModal === 'rule' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto pt-20">
          <Card className="w-full max-w-2xl p-8 shadow-2xl bg-white border-0 my-8">
            <h2 className="text-2xl font-black font-headline mb-6">Configurar Cascada de Tiempos</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('scheduling_rules', editingItem) }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Nombre de la Regla</label>
                <Input value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="Ej: Secos > 1500 cajas..." required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Tipo de Carga</label>
                <select className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-bold border-0" value={editingItem.environment_id || ''} onChange={e => setEditingItem({...editingItem, environment_id: Number(e.target.value) || null})}>
                  <option value="">Cualquier Tipo de Carga</option>
                  {environments.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Tipo Vehículo</label>
                <select className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-bold border-0" value={editingItem.vehicle_type_id || ''} onChange={e => setEditingItem({...editingItem, vehicle_type_id: Number(e.target.value) || null})}>
                  <option value="">Cualquier Vehículo</option>
                  {vehicleTypes.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Prioridad de Aplicación</label>
                <select 
                  className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-bold border-0" 
                  value={editingItem.priority ?? 1} 
                  onChange={e => setEditingItem({...editingItem, priority: Number(e.target.value)})}
                >
                  {PRIORITY_LEVELS.slice().reverse().map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Mín Cajas</label>
                  <Input type="number" value={editingItem.min_boxes ?? ''} onChange={e => setEditingItem({...editingItem, min_boxes: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Máx Cajas</label>
                  <Input type="number" value={editingItem.max_boxes ?? ''} onChange={e => setEditingItem({...editingItem, max_boxes: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-4 md:col-span-2 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-black font-headline">Tipo de Duración</label>
                    <p className="text-[10px] text-on-surface-variant">¿Tiempo fijo o calculado por eficiencia del vehículo?</p>
                  </div>
                  <div className="flex bg-surface-container rounded-xl p-1 gap-1">
                    <button 
                      type="button"
                      onClick={() => setEditingItem({...editingItem, is_dynamic: false})}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                        !editingItem.is_dynamic ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
                      )}
                    >
                      TIEMPO FIJO
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingItem({...editingItem, is_dynamic: true, efficiency_multiplier: editingItem.efficiency_multiplier || 1.0})}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                        editingItem.is_dynamic ? "bg-white text-purple-700 shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
                      )}
                    >
                      CALCULADO
                    </button>
                  </div>
                </div>

                {editingItem.is_dynamic ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-on-surface-variant text-primary">Tiempo p/ Mín Cajas ({editingItem.min_boxes || 0})</label>
                        <Input 
                          type="number" 
                          className="text-primary font-black text-xl" 
                          value={editingItem.duration_minutes ?? ''} 
                          onChange={e => setEditingItem({...editingItem, duration_minutes: Number(e.target.value)})} 
                          required 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-on-surface-variant text-rose-600">Tiempo p/ Máx Cajas ({editingItem.max_boxes || '∞'})</label>
                        <Input 
                          type="number" 
                          className="text-rose-600 font-black text-xl" 
                          value={editingItem.max_duration_minutes ?? ''} 
                          onChange={e => setEditingItem({...editingItem, max_duration_minutes: Number(e.target.value)})} 
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    {!editingItem.max_duration_minutes ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-on-surface-variant">Multiplicador de Eficiencia (Fallback)</label>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            step="0.1"
                            className="text-purple-700 font-black text-lg" 
                            value={editingItem.efficiency_multiplier ?? 1.0} 
                            onChange={e => setEditingItem({...editingItem, efficiency_multiplier: Number(e.target.value)})} 
                            required 
                          />
                          <div className="flex-1 bg-purple-50 p-2 rounded-xl border border-purple-100">
                            <p className="text-[9px] text-purple-700 leading-tight">
                              Usa la base del vehículo escalada por {editingItem.efficiency_multiplier || 1}x.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase text-on-surface-variant">Previsualización del Cálculo (LERP)</span>
                          <span className="px-2 py-0.5 bg-rose-500 text-white rounded text-[8px] font-black">ACTIVO</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[0.25, 0.5, 0.75].map(ratio => {
                            const boxes = Math.round((editingItem.min_boxes || 0) + ((editingItem.max_boxes || 0) - (editingItem.min_boxes || 0)) * ratio);
                            const time = Math.ceil((editingItem.duration_minutes || 0) + ((editingItem.max_duration_minutes || 0) - (editingItem.duration_minutes || 0)) * ratio);
                            return (
                              <div key={ratio} className="bg-white p-2 rounded-lg shadow-sm border border-outline-variant/10 text-center">
                                <p className="text-[10px] font-black text-on-surface">{boxes} Cajas</p>
                                <p className="text-xl font-black text-rose-600 leading-none my-1">{time}</p>
                                <p className="text-[8px] font-bold text-on-surface-variant uppercase">Minutos</p>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-[9px] text-on-surface-variant italic leading-tight">
                          * El sistema calculará el tiempo exacto proporcional a la cantidad de cajas dentro de este rango.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant">Duración Estimada (Minutos)</label>
                    <Input 
                      type="number" 
                      className="text-green-600 font-black text-xl" 
                      value={editingItem.duration_minutes ?? ''} 
                      onChange={e => setEditingItem({...editingItem, duration_minutes: Number(e.target.value)})} 
                      required 
                    />
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-rose-600 text-white" disabled={saving}>Guardar Regla</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL LÍMITE (REUTILIZADO) */}
      {activeModal === 'limit' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Capacidad de Cajas</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('daily_capacity_limits', editingItem) }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Tipo de Carga</label>
                <select className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-bold border-0" value={editingItem.environment_id || ''} onChange={e => setEditingItem({...editingItem, environment_id: Number(e.target.value)})} required>
                  <option value="">Seleccionar...</option>
                  {environments.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Límite Normal</label>
                  <Input type="number" value={editingItem.normal_box_limit || ''} onChange={e => setEditingItem({...editingItem, normal_box_limit: Number(e.target.value)})} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Límite Extendido</label>
                  <Input type="number" value={editingItem.extended_box_limit || ''} onChange={e => setEditingItem({...editingItem, extended_box_limit: Number(e.target.value)})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Inicio Extendido</label>
                  <Input type="time" value={editingItem.extended_start_time || ''} onChange={e => setEditingItem({...editingItem, extended_start_time: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">Fin Extendido</label>
                  <Input type="time" value={editingItem.extended_end_time || ''} onChange={e => setEditingItem({...editingItem, extended_end_time: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-amber-500 text-white" disabled={saving}>Guardar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL TIPO DE CARGA (REUTILIZADO) */}
      {activeModal === 'env' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-sm p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Configurar Tipo de Carga</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('environments', editingItem) }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Nombre de Muestra</label>
                <Input value={editingItem.display_name || ''} onChange={e => setEditingItem({...editingItem, display_name: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_')})} placeholder="Ej: Secos, Fríos..." required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Icono Visual</label>
                <div className="grid grid-cols-6 gap-2 bg-surface-container-low p-3 rounded-xl max-h-[160px] overflow-y-auto border border-outline-variant/10">
                  {LOGISTICS_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, icon })}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110",
                        editingItem.icon === icon 
                          ? "bg-primary text-white shadow-lg scale-110 z-10" 
                          : "bg-white text-on-surface-variant hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </button>
                  ))}
                </div>
                {editingItem.icon && (
                  <p className="text-[9px] font-bold text-center text-primary uppercase pt-1">
                    Seleccionado: {editingItem.icon}
                  </p>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={saving}>Guardar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
