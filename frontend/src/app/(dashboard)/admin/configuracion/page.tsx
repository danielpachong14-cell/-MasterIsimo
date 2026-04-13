"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Environment, 
  DailyCapacityLimit, 
  SchedulingRule, 
  VehicleType, 
  ProductCategory, 
  Dock 
} from "@/types"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/utils"

export default function ConfiguracionPage() {
  // --- ESTADO DE DATOS ---
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [limits, setLimits] = useState<DailyCapacityLimit[]>([])
  const [rules, setRules] = useState<SchedulingRule[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [cediSettings, setCediSettings] = useState<any>(null)
  
  // --- ESTADOS DE CARGA ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // --- ESTADO DE MODALES Y EDICIÓN ---
  const [activeModal, setActiveModal] = useState<'env' | 'limit' | 'rule' | 'vehicle' | 'category' | 'dock' | 'cedi' | null>(null)
  const [editingItem, setEditingItem] = useState<any>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [envRes, limitRes, ruleRes, vehRes, catRes, dockRes, cediRes] = await Promise.all([
        supabase.from('environments').select('*').eq('is_active', true),
        supabase.from('daily_capacity_limits').select('*, environment:environments(*)').eq('is_active', true),
        supabase.from('scheduling_rules').select('*, environment:environments(*), vehicle_type:vehicle_types(*), category:product_categories(*)').order('priority', { ascending: true }),
        supabase.from('vehicle_types').select('*').eq('is_active', true),
        supabase.from('product_categories').select('*').eq('is_active', true),
        supabase.from('docks').select('*, environment:environments(*)').eq('is_active', true).order('name'),
        supabase.from('cedi_settings').select('*').single()
      ])

      if (envRes.data) setEnvironments(envRes.data)
      if (limitRes.data) setLimits(limitRes.data)
      if (ruleRes.data) setRules(ruleRes.data)
      if (vehRes.data) setVehicleTypes(vehRes.data)
      if (catRes.data) setCategories(catRes.data)
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

  const handleSave = async (table: string, data: any) => {
    setSaving(true)
    try {
      // 1. Limpieza profunda del payload
      // Extraemos relaciones y campos automáticos que fallarían en un 'upsert'
      const { environment, vehicle_type, category, created_at, updated_at, ...cleanPayload } = data
      
      // 2. Manejo de ID y campos por defecto
      const payload = { ...cleanPayload }
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
    } catch (error: any) {
      console.groupEnd()
      alert(`⚠️ Problema al guardar en ${table}:\n${error.message || error}`)
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (table: string, id: any, logical: boolean = true) => {
    const action = logical ? "Desactivar" : "Eliminar"
    if (!confirm(`¿Estás seguro de que deseas ${action.toLowerCase()} este registro?`)) return
    
    try {
      const { error } = logical 
        ? await supabase.from(table).update({ is_active: false }).eq('id', id)
        : await supabase.from(table).delete().eq('id', id)
      
      if (error) throw error
      fetchData()
    } catch (error) {
      alert(`Error al procesar acción en ${table}`)
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

      {/* --- BLOQUE 1: INFRAESTRUCTURA (AMBIENTES Y MUELLES) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECCIÓN: AMBIENTES OPERATIVOS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined text-2xl">warehouse</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Ambientes</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Zonas del CEDI</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('env') }} size="sm" className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nuevo
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {environments.map(env => (
              <Card key={env.id} className="p-5 border-white/50 bg-white/40 backdrop-blur-md group hover:shadow-lg transition-all border">
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
                    <button onClick={() => handleDelete('environments', env.id)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black font-headline truncate">{env.display_name}</h3>
                <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">{env.name}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* SECCIÓN: MUELLES / DOCKS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
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
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-lowest sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Nombre</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Ambiente</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {docks.map(dock => (
                    <tr key={dock.id} className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="px-5 py-3 font-bold text-sm">{dock.name}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                          dock.environment?.name === 'Secos' ? "bg-amber-100 text-amber-700" : 
                          dock.environment?.name === 'Fríos' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {dock.environment?.display_name || 'Sin Asignar'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingItem(dock); setActiveModal('dock') }} className="p-1.5 hover:bg-primary/10 text-primary rounded-lg">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => handleDelete('docks', dock.id)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg">
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

      {/* --- BLOQUE 2: PARÁMETROS MAESTROS (VEHÍCULOS Y CATEGORÍAS) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECCIÓN: TIPOS DE VEHÍCULOS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600 shadow-sm">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Vehículos</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Base de Cálculo</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('vehicle') }} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nuevo Tipo
            </Button>
          </div>
          
          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-lowest">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Nombre</th>
                  <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Cajas Base</th>
                  <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Tiempo</th>
                  <th className="px-5 py-3 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {vehicleTypes.map(v => (
                  <tr key={v.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-5 py-3 font-bold text-sm text-on-surface">{v.name}</td>
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
                        <button onClick={() => handleDelete('vehicle_types', v.id)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        {/* SECCIÓN: CATEGORÍAS DE PRODUCTO */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                <span className="material-symbols-outlined text-2xl">category</span>
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline">Categorías</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Segmentación</p>
              </div>
            </div>
            <Button onClick={() => { setEditingItem({}); setActiveModal('category') }} variant="secondary" size="sm" className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nueva
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map(cat => (
              <Card key={cat.id} className="p-4 border-white/50 bg-white/40 backdrop-blur-md group hover:bg-white/80 transition-all border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-on-surface">{cat.display_name}</h3>
                  <p className="text-[9px] text-on-surface-variant font-mono uppercase italic">{cat.name}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingItem(cat); setActiveModal('category') }} className="p-1.5 hover:bg-primary/10 text-primary rounded-lg">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button onClick={() => handleDelete('product_categories', cat.id)} className="p-1.5 hover:bg-error-container hover:text-error rounded-lg">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* --- BLOQUE 3: LÓGICA DE NEGOCIO (CAPACIDADES Y REGLAS) --- */}
      <div className="space-y-12">
        
        {/* SECCIÓN: SOFT LIMITS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
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
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-lowest">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Ambiente</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Límite Normal</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Límite Extendido</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Horario Ext.</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {limits.map(limit => (
                  <tr key={limit.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                        limit.environment?.name === 'Secos' ? "bg-amber-100 text-amber-700" : 
                        limit.environment?.name === 'Fríos' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      )}>
                        {limit.environment?.display_name}
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
                      <button onClick={() => { setEditingItem(limit); setActiveModal('limit') }} className="p-2 hover:bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <Button onClick={() => { setEditingItem({ priority: rules.length * 10 }); setActiveModal('rule') }} className="gap-2 shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-lg">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              Nueva Regla
            </Button>
          </div>

          <Card className="overflow-hidden border-outline-variant/30 shadow-subtle bg-white/60">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-lowest">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">P</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Nombre</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Ambiente</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Vehículo</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Rango Cajas</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">Duración</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-on-surface-variant uppercase text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4"><span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-black">{rule.priority}</span></td>
                    <td className="px-6 py-4 font-bold text-sm text-on-surface">{rule.name}</td>
                    <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">{rule.environment?.display_name || 'Todos'}</td>
                    <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">{rule.vehicle_type?.name || 'Todos'}</td>
                    <td className="px-6 py-4 font-mono font-bold text-xs">{rule.min_boxes} — {rule.max_boxes || '∞'}</td>
                    <td className="px-6 py-4">
                      <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-lg text-xs font-black">
                        {rule.duration_minutes} min
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(rule); setActiveModal('rule') }} className="p-2 hover:bg-primary/10 text-primary rounded-lg">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete('scheduling_rules', rule.id, false)} className="p-2 hover:bg-error-container hover:text-error rounded-lg">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Ambiente Operativo</label>
                <select 
                  className="w-full bg-surface-container rounded-xl px-4 h-12 text-sm font-bold border-0"
                  value={editingItem.environment_id || ''}
                  onChange={e => setEditingItem({...editingItem, environment_id: Number(e.target.value)})}
                  required
                >
                  <option value="">Seleccionar Ambiente...</option>
                  {environments.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                </select>
              </div>
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

      {/* MODAL CATEGORÍA */}
      {activeModal === 'category' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-sm p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Categoría</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('product_categories', editingItem) }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Nombre para el sistema</label>
                <Input value={editingItem.display_name || ''} onChange={e => setEditingItem({...editingItem, display_name: e.target.value, name: e.target.value.toUpperCase().replace(/\s+/g, '_')})} placeholder="Ej: Frutas y Verduras..." required />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-orange-600 text-white" disabled={saving}>Guardar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL REGLA (REUTILIZADO Y MEJORADO) */}
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
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Ambiente</label>
                <select className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-bold border-0" value={editingItem.environment_id || ''} onChange={e => setEditingItem({...editingItem, environment_id: Number(e.target.value) || null})}>
                  <option value="">Cualquier Ambiente</option>
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
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Prioridad</label>
                <Input type="number" value={editingItem.priority ?? ''} onChange={e => setEditingItem({...editingItem, priority: Number(e.target.value)})} />
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
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Duración Estimada (Minutos)</label>
                <Input type="number" className="text-green-600 font-black text-xl" value={editingItem.duration_minutes ?? ''} onChange={e => setEditingItem({...editingItem, duration_minutes: Number(e.target.value)})} required />
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
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Ambiente</label>
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
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-amber-500 text-white" disabled={saving}>Guardar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL AMBIENTE (REUTILIZADO) */}
      {activeModal === 'env' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-sm p-8 shadow-2xl bg-white border-0">
            <h2 className="text-2xl font-black font-headline mb-6">Configurar Ambiente</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave('environments', editingItem) }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Nombre de Muestra</label>
                <Input value={editingItem.display_name || ''} onChange={e => setEditingItem({...editingItem, display_name: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_')})} placeholder="Ej: Secos, Fríos..." required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Icono (Material Symbol)</label>
                <Input value={editingItem.icon || ''} onChange={e => setEditingItem({...editingItem, icon: e.target.value})} placeholder="warehouse, hvac, water_drop..." />
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
