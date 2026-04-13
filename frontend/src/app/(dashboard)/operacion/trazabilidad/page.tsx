"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Appointment, VehicleType, PaginatedResult } from "@/types"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { cn, formatDate, formatTime } from "@/lib/utils"

import { WalkInModal } from "./components/WalkInModal"
import { EditAppointmentModal } from "./components/EditAppointmentModal"
import { DeleteAppointmentModal } from "./components/DeleteAppointmentModal"
import { AppointmentDetailsModal } from "./components/AppointmentDetailsModal"
import { ScheduleSupplierModal } from "@/components/ui/ScheduleSupplierModal" // Usamos el Schedule normal para +Nueva Cita

export default function TrazabilidadPage() {
  const [data, setData] = useState<PaginatedResult<Appointment> | null>(null)
  const [loading, setLoading] = useState(true)
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const supabase = createClient()

  // Filtros y Paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [filters, setFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    status: '',
    licensePlate: '',
    companyName: ''
  })
  
  // Debounce refs para filtros de texto
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Modales
  const [isWalkInOpen, setIsWalkInOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [deleteAppt, setDeleteAppt] = useState<Appointment | null>(null)
  const [detailsAppt, setDetailsAppt] = useState<Appointment | null>(null)

  // Quick Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, finished: 0, walkins: 0 })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res, error } = await supabase.rpc('get_appointments_paginated', {
        p_date_from: filters.dateFrom || null,
        p_date_to: filters.dateTo || null,
        p_status: filters.status || null,
        p_license_plate: filters.licensePlate || null,
        p_company_name: filters.companyName || null,
        p_page: page,
        p_page_size: pageSize
      })

      if (error) throw error
      
      const parsedData = res as PaginatedResult<Appointment>
      setData(parsedData)

      // Calculate quick stats logic (only for current view or separately? Let's do it for current data logic, or separate query for day stats)
      // Actually, since we want day stats, let's just compute from current data if it's not paginated, OR do a quick separate query
      const today = new Date().toISOString().split('T')[0]
      if (filters.dateFrom === today && filters.dateTo === today && !filters.licensePlate && !filters.companyName) {
        setStats({
          total: parsedData.total_count,
          pending: parsedData.data.filter(a => a.status === 'PENDIENTE').length,
          finished: parsedData.data.filter(a => a.status === 'FINALIZADO').length,
          walkins: parsedData.data.filter(a => a.is_walk_in).length
        })
      }
    } catch (err) {
      console.error("Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase, filters, page, pageSize])

  useEffect(() => {
    fetchAppointments()

    // Realtime subscription for auto check-in and dashboard updates
    const channel = supabase
      .channel('public:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
         // Silently fetch to keep the UI up-to-date with new Check-Ins
         fetchAppointments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAppointments, supabase])

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data } = await supabase.from('vehicle_types').select('*').eq('is_active', true)
      if (data) setVehicleTypes(data)
    }
    fetchVehicles()
  }, [supabase])

  // Manejo de Filtros de Texto con Debounce
  const handleTextFilter = (key: 'licensePlate' | 'companyName', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleUpdateStatus = async (appointment: Appointment, newStatus: string) => {
    const currentStatus = appointment.status
    if (currentStatus === newStatus) return

    // Eliminamos el confirm para mayor agilidad, similar al Kanban
    // if (!confirm(`¿Cambiar estado a ${newStatus}?`)) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // 1. Actualizar el estado con verificación y Auto-KPIs de tiempo
      const updates: any = { status: newStatus }
      
      if (newStatus === 'DESCARGANDO') {
        updates.start_unloading_time = new Date().toISOString()
      } else if (newStatus === 'FINALIZADO') {
        updates.end_unloading_time = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointment.id)
      
      if (updateError) {
        throw new Error(`Error en base de datos: ${updateError.message}`)
      }
      
      // 2. Intentar auditoría (no bloquente si falla la tabla de audit)
      const { error: auditError } = await supabase.from('appointment_audit_log').insert({
        appointment_id: appointment.id,
        user_id: user?.id,
        action: 'STATUS_CHANGE',
        changed_fields: { status: { old: currentStatus, new: newStatus } },
        notes: 'Cambio manual desde Trazabilidad'
      })
      if (auditError) {
        console.warn("La auditoría no pudo registrarse, pero el cambio de estado fue exitoso:", auditError.message)
      }

      fetchAppointments()
    } catch (err: any) {
      console.error("Error updating status:", err)
      alert(`No se pudo actualizar el estado: ${err.message || "Error desconocido"}`)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE': return 'bg-surface-container-high text-on-surface'
      case 'EN_PORTERIA': return 'bg-cyan-100 text-cyan-800 border-cyan-200'
      case 'EN_PATIO': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'EN_MUELLE': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'DESCARGANDO': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'FINALIZADO': return 'bg-green-100 text-green-800 border-green-200'
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100'
    }
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      
      {/* HEADER & DATAGRID CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="space-y-1">
            <h1 className="text-3xl font-black font-headline tracking-tighter text-on-surface">DataGrid Operativo</h1>
            <p className="text-sm text-on-surface-variant font-medium">Búsqueda avanzada y gestión de citas</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex divide-x divide-surface-container bg-surface-container-low rounded-xl px-4 py-2 border border-surface-container-high/50 shadow-sm">
              <div className="px-4 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Total Hoy</p>
                <p className="text-xl font-black text-on-surface">{stats.total}</p>
              </div>
              <div className="px-4 text-center">
                <p className="text-xs text-primary/60 uppercase tracking-widest font-bold">Walk-Ins</p>
                <p className="text-xl font-black text-amber-500">{stats.walkins}</p>
              </div>
            </div>

            <Button variant="secondary" className="gap-2 shrink-0 border-surface-container-high bg-white hover:bg-surface-container-lowest" onClick={() => setIsScheduleOpen(true)}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Nueva Cita (Auto)
            </Button>
            <Button className="gap-2 shrink-0 bg-amber-500 hover:bg-amber-600 border-amber-500 hover:border-amber-600 text-white shadow-md shadow-amber-500/20" onClick={() => setIsWalkInOpen(true)}>
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              Ingreso Express
            </Button>
          </div>
        </div>

        <Card variant="elevated" className="flex-1 shrink-0 p-0 overflow-hidden flex flex-col border border-surface-container shadow-sm rounded-2xl bg-white">
          
          {/* FILTERS BAR */}
          <div className="p-4 border-b border-surface-container bg-surface-container-lowest flex items-center gap-3 overflow-x-auto shrink-0">
            <div className="flex-1 min-w-[200px]">
              <Input 
                placeholder="Buscar patente..." 
                className="uppercase bg-white h-10 text-sm"
                value={filters.licensePlate}
                onChange={e => handleTextFilter('licensePlate', e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input 
                placeholder="Buscar empresa..." 
                className="bg-white h-10 text-sm"
                value={filters.companyName}
                onChange={e => handleTextFilter('companyName', e.target.value)}
              />
            </div>
            <div className="shrink-0">
              <select 
                className="h-10 px-3 rounded-lg border-2 border-surface-container focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-medium text-sm bg-white cursor-pointer"
                value={filters.status}
                onChange={e => { setFilters({...filters, status: e.target.value}); setPage(1) }}
                title="Status Filter"
              >
                <option value="">Todos los Estados</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_PORTERIA">En Portería</option>
                <option value="EN_PATIO">En Patio</option>
                <option value="EN_MUELLE">En Muelle</option>
                <option value="DESCARGANDO">Descargando</option>
                <option value="FINALIZADO">Finalizado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <div className="flex items-center gap-2 shrink-0 bg-white rounded-lg p-1 border-2 border-surface-container">
              <input type="date" className="text-sm font-medium border-none focus:ring-0 outline-none p-1.5" value={filters.dateFrom} onChange={e => { setFilters({...filters, dateFrom: e.target.value}); setPage(1) }} title="Date From" />
              <span className="text-on-surface-variant/40">-</span>
              <input type="date" className="text-sm font-medium border-none focus:ring-0 outline-none p-1.5" value={filters.dateTo} onChange={e => { setFilters({...filters, dateTo: e.target.value}); setPage(1) }} title="Date To" />
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="flex-1 overflow-auto bg-surface-container-lowest">
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-surface-container-low shadow-[0_1px_0_theme(colors.surface.container)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black tracking-widest text-on-surface-variant/70 uppercase">ID / Estado</th>
                  <th className="px-4 py-3 text-[10px] font-black tracking-widest text-on-surface-variant/70 uppercase">Empresa & POs</th>
                  <th className="px-4 py-3 text-[10px] font-black tracking-widest text-on-surface-variant/70 uppercase">Logística</th>
                  <th className="px-4 py-3 text-[10px] font-black tracking-widest text-on-surface-variant/70 uppercase">Tiempos (Min)</th>
                  <th className="px-4 py-3 text-[10px] font-black tracking-widest text-on-surface-variant/70 uppercase">Ubicación</th>
                  <th className="px-4 py-3 text-[10px] font-black tracking-widest text-on-surface-variant/70 uppercase text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {loading && !data ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="inline-flex items-center gap-2 text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin">refresh</span>
                        <span className="font-medium">Cargando registros...</span>
                      </div>
                    </td>
                  </tr>
                ) : data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-on-surface-variant">
                      No se encontraron registros para estos filtros.
                    </td>
                  </tr>
                ) : data?.data.map((a) => (
                  <tr key={a.id} onClick={() => setDetailsAppt(a)} className={cn(
                    "group hover:bg-white transition-colors cursor-pointer",
                    a.is_walk_in ? "bg-amber-50/30" : ""
                  )}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="text-[10px] font-mono text-on-surface-variant border border-surface-container-high/30 bg-surface-container/30 px-1 rounded">{a.id.split('-')[0]}</span>
                        <div className={cn(
                          "px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider",
                          getStatusBadge(a.status)
                        )}>
                          {a.status}
                        </div>
                        {a.punctuality_status && a.punctuality_status !== 'N/A (Sin Cita)' && (
                          <div className={cn(
                            "text-[9px] font-black tracking-widest uppercase mt-0.5",
                            a.punctuality_status === 'TARDE' ? "text-red-600" : 
                            a.punctuality_status === 'A_TIEMPO' ? "text-green-600" : "text-blue-600"
                          )}>
                            {a.punctuality_status.replace('_', ' ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface">{a.company_name}</span>
                          {a.is_walk_in && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-sm">
                              <span className="material-symbols-outlined text-[10px]">bolt</span> EXPRESS
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {a.appointment_purchase_orders?.filter(po => po.po_number).map(po => (
                            <span key={po.id} className="text-[9px] font-bold text-primary/70 bg-primary/5 px-1 py-0.5 rounded border border-primary/10">
                              {po.po_number || "S/N"} ({po.box_count} cjs)
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface">{a.license_plate}</span>
                        <span className="text-xs text-on-surface-variant">Agendado: {formatTime(a.scheduled_time)}</span>
                        {a.arrival_time && (
                          <span className="text-[10px] font-bold text-primary">Llegada: {new Date(a.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {/* Espera calculation */}
                        {a.arrival_time && a.start_unloading_time ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-on-surface-variant/60">Espera:</span>
                            <span className={cn(
                              "text-xs font-black px-1.5 py-0.5 rounded",
                              Math.round((new Date(a.start_unloading_time).getTime() - new Date(a.arrival_time).getTime()) / 60000) > 60 
                                ? "bg-red-100 text-red-700" 
                                : "bg-surface-container text-on-surface"
                            )}>
                              {Math.round((new Date(a.start_unloading_time).getTime() - new Date(a.arrival_time).getTime()) / 60000)} min
                            </span>
                          </div>
                        ) : a.arrival_time && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-on-surface-variant/60">Espera:</span>
                            <span className="text-xs font-black animate-pulse text-primary">En patio...</span>
                          </div>
                        )}
                        
                        {/* Descargue calculation */}
                        {a.start_unloading_time && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-on-surface-variant/60">Descargue:</span>
                            {a.end_unloading_time ? (
                              <span className="text-xs font-black bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                {Math.round((new Date(a.end_unloading_time).getTime() - new Date(a.start_unloading_time).getTime()) / 60000)} min
                              </span>
                            ) : (
                              <span className="text-xs font-black animate-pulse text-blue-600">Descargando ({Math.round((new Date().getTime() - new Date(a.start_unloading_time).getTime()) / 60000)} min)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {a.dock_name ? (
                          <span className="inline-flex items-center gap-1 font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md text-[11px] w-fit">
                            <span className="material-symbols-outlined text-[14px]">warehouse</span>
                            {a.dock_name}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/40 text-[10px] italic">No asignado</span>
                        )}
                        <span className="text-[10px] font-bold text-on-surface-variant/60">{a.vehicle_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* ACCIONES (Menu Contextual simple o botones) */}
                      <div className="flex items-center justify-end gap-1">
                        {/* Status Change Styled Select (Habilitado para todos los estados) */}
                        <div className="relative">
                          <select 
                            title="Cambiar Estado"
                            className="h-8 px-2 pr-6 rounded-lg border-2 border-surface-container bg-white text-[10px] font-black uppercase tracking-wider text-on-surface-variant hover:border-primary focus:border-primary transition-all outline-none cursor-pointer appearance-none"
                            value={a.status}
                            onChange={(e) => handleUpdateStatus(a, e.target.value)}
                          >
                            <option value="PENDIENTE">PENDIENTE</option>
                            <option value="EN_PORTERIA">EN PORTERÍA</option>
                            <option value="EN_PATIO">EN PATIO</option>
                            <option value="EN_MUELLE">EN MUELLE</option>
                            <option value="DESCARGANDO">DESCARGANDO</option>
                            <option value="FINALIZADO">FINALIZADO</option>
                            <option value="CANCELADO">CANCELADO</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] pointer-events-none text-on-surface-variant/40">
                            unfold_more
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditAppt(a)} className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors" title="Editar Información">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => setDeleteAppt(a)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-on-surface-variant hover:text-red-500 transition-colors" title="Eliminar Cita">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION FOOTER */}
          <div className="p-3 border-t border-surface-container bg-surface-container-lowest flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-on-surface-variant">Filas por página:</span>
              <select className="text-xs border-none bg-surface-container/50 rounded p-1 outline-none font-bold" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
                <option value="10">10</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-on-surface-variant">
                {data ? `${((page - 1) * pageSize) + 1} - ${Math.min(page * pageSize, data.total_count)} de ${data.total_count}` : '0 - 0 de 0'}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded bg-surface border border-surface-container flex items-center justify-center disabled:opacity-50 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button 
                  disabled={!data || page >= data.total_pages} 
                  onClick={() => setPage(p => p + 1)}
                  className="w-7 h-7 rounded bg-surface border border-surface-container flex items-center justify-center disabled:opacity-50 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* MODALS */}
      <WalkInModal 
        isOpen={isWalkInOpen} 
        onClose={() => setIsWalkInOpen(false)} 
        onSuccess={fetchAppointments}
        vehicleTypes={vehicleTypes}
      />

      <EditAppointmentModal 
        isOpen={!!editAppt} 
        onClose={() => setEditAppt(null)} 
        onSuccess={fetchAppointments} 
        appointment={editAppt}
        vehicleTypes={vehicleTypes}
      />

      <DeleteAppointmentModal 
        isOpen={!!deleteAppt} 
        onClose={() => setDeleteAppt(null)} 
        onSuccess={fetchAppointments}
        appointment={deleteAppt}
      />

      <AppointmentDetailsModal 
        isOpen={!!detailsAppt}
        onClose={() => setDetailsAppt(null)}
        appointment={detailsAppt}
        onSuccess={fetchAppointments}
      />

      <ScheduleSupplierModal 
        isOpen={isScheduleOpen} 
        onClose={() => setIsScheduleOpen(false)}
      />

    </div>
  )
}
