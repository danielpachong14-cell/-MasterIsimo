"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { calculateDuration, getAvailableSlots } from "@/lib/services/scheduling"

interface VehicleType {
  id: number
  name: string
  base_boxes: number
  base_time_minutes: number
  maneuver_time_minutes: number
}

interface PurchaseOrder {
  poNumber: string
  boxCount: string
}

export default function SupplierRegistrationPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    companyName: '',
    vehicleTypeId: '',
    licensePlate: '',
    driverName: '',
    driverPhone: '',
    scheduledDate: '',
    scheduledTime: '',
  })

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([
    { poNumber: '', boxCount: '' }
  ])

  // Data
  const [vehicles, setVehicles] = useState<VehicleType[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [durationInfo, setDurationInfo] = useState({ real: 0, buffer: 0 })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    // Cargar vehículos activos
    async function loadVehicles() {
      const { data } = await supabase.from('vehicle_types').select('*').eq('is_active', true)
      if (data) setVehicles(data)
    }
    loadVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNextStep = () => {
    setErrorMessage(null)
    setStep(s => s + 1)
  }
  const handlePrevStep = () => setStep(s => s - 1)

  const isStep1Valid = formData.companyName && formData.vehicleTypeId && formData.licensePlate && formData.driverName;
  const isStep2Valid = purchaseOrders.length > 0 && purchaseOrders.every(po => po.poNumber && parseInt(po.boxCount) > 0);

  // Calcula cajas totales sumando todas las OCs
  const getTotalBoxCount = () => {
    return purchaseOrders.reduce((sum, current) => sum + (parseInt(current.boxCount) || 0), 0);
  }

  // Disparador al seleccionar una fecha (paso 3)
  useEffect(() => {
    if (step === 3 && formData.scheduledDate && formData.vehicleTypeId && getTotalBoxCount() > 0) {
      loadSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formData.scheduledDate, formData.vehicleTypeId])

  async function loadSlots() {
    setLoading(true)
    const vehicle = vehicles.find(v => v.id.toString() === formData.vehicleTypeId)
    if (!vehicle) {
      setLoading(false)
      return
    }

    const totalBoxes = getTotalBoxCount()
    const { realMinutes, bufferMinutes } = calculateDuration(
      totalBoxes, 
      vehicle.base_boxes, 
      vehicle.base_time_minutes, 
      vehicle.maneuver_time_minutes
    )
    
    setDurationInfo({ real: realMinutes, buffer: bufferMinutes })

    // Motor logico
    const slots = await getAvailableSlots(formData.scheduledDate, realMinutes)
    setAvailableSlots(slots)
    setLoading(false)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      const endTime = calculateEndTime(formData.scheduledTime, durationInfo.real)

      // 1. Reservar cita con asignación automática de muelle (transaccional, anti-colisión)
      const { data: appointmentId, error: rpcError } = await supabase.rpc('book_appointment_transactional', {
        p_company_name: formData.companyName,
        p_vehicle_type_id: parseInt(formData.vehicleTypeId),
        p_vehicle_type: vehicles.find(v => v.id.toString() === formData.vehicleTypeId)?.name || 'N/A',
        p_scheduled_date: formData.scheduledDate,
        p_scheduled_time: formData.scheduledTime,
        p_estimated_duration: durationInfo.real,
        p_scheduled_end_time: endTime,
        p_driver_name: formData.driverName,
        p_driver_phone: formData.driverPhone,
        p_license_plate: formData.licensePlate,
      })

      if (rpcError) {
        if (rpcError.message?.includes('NO_DOCK_AVAILABLE')) {
          throw new Error('Lo sentimos, esta franja horaria acaba de ocuparse por otro proveedor. Por favor selecciona un horario diferente.');
        }
        if (rpcError.code === '23505') {
          throw new Error('Ya existe una cita programada para esta placa en esta fecha y franja horaria.');
        }
        throw rpcError
      }

      // 2. Insertar todas las OCs asociadas al appointment
      const ordersToInsert = purchaseOrders.map(po => ({
        appointment_id: appointmentId,
        po_number: po.poNumber,
        box_count: parseInt(po.boxCount)
      }))

      const { error: poError } = await supabase
        .from('appointment_purchase_orders')
        .insert(ordersToInsert)

      if (poError) throw poError

      setStep(4) // Success layout
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErrorMessage(err.message || "Hubo un error inesperado al registrar el agendamiento.")
    } finally {
      setLoading(false)
    }
  }

  const handleResetForAnotherVehicle = () => {
    // Retain company name but reset others
    setFormData(prev => ({
      ...prev,
      vehicleTypeId: '',
      licensePlate: '',
      driverName: '',
      driverPhone: '',
      scheduledDate: '',
      scheduledTime: ''
    }))
    setPurchaseOrders([{ poNumber: '', boxCount: '' }])
    setErrorMessage(null)
    setStep(1)
  }

  function calculateEndTime(startStr: string, addMins: number) {
    if (!startStr) return null;
    const parts = startStr.split(':')
    const mins = parseInt(parts[0]) * 60 + parseInt(parts[1]) + addMins
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
  }

  const handleAddOrder = () => {
    setPurchaseOrders([...purchaseOrders, { poNumber: '', boxCount: '' }])
  }

  const handleRemoveOrder = (idx: number) => {
    const newArr = [...purchaseOrders];
    newArr.splice(idx, 1);
    setPurchaseOrders(newArr);
  }

  const handleOrderChange = (idx: number, field: keyof PurchaseOrder, value: string) => {
    const newArr = [...purchaseOrders];
    newArr[idx][field] = value;
    setPurchaseOrders(newArr);
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      
      <div className="max-w-2xl w-full">
        <div className="mb-10 text-center space-y-2">
           <h1 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Agendamiento de Cargas</h1>
           <p className="text-sm font-bold text-primary/60 tracking-widest uppercase">CEDI Isimo - Configuración por Vehículo</p>
        </div>

        <Card variant="elevated" className="overflow-hidden bg-white/70 backdrop-blur-xl border-surface-container-low/50">
           
           {/* Navigation Progress Bar */}
           {step < 4 && (
            <div className="flex bg-surface-container-low/30 p-4 border-b border-surface-container gap-2">
              {[1,2,3].map(num => (
                <div key={num} className="flex-1 h-2 rounded-full overflow-hidden bg-surface-container">
                  <div className={`h-full bg-primary transition-all duration-500 w-full ${step >= num ? 'opacity-100' : 'opacity-0 -translate-x-full'}`} />
                </div>
              ))}
            </div>
           )}

           <div className="p-8 sm:p-12">
             
             {errorMessage && (
               <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3">
                 <span className="material-symbols-outlined">error</span>
                 <p className="text-sm font-bold">{errorMessage}</p>
               </div>
             )}

             {step === 1 && (
               <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                 <h2 className="text-2xl font-black font-headline">Datos del Vehículo y Transportador</h2>
                 <div className="space-y-4">
                   <div>
                     <label className="text-xs font-bold uppercase tracking-wider text-primary/50 block mb-2">Razón Social</label>
                     <Input 
                       placeholder="Nombre de la empresa proveedora"
                       value={formData.companyName}
                       onChange={e => setFormData({...formData, companyName: e.target.value})}
                     />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-primary/50 block mb-2">Placa de Vehículo</label>
                        <Input 
                          placeholder="AAA-123"
                          value={formData.licensePlate}
                          onChange={e => setFormData({...formData, licensePlate: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-primary/50 block mb-2">Tipo de Vehículo</label>
                        <select 
                          className="flex w-full rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-4 text-sm font-bold transition-all placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/20 appearance-none disabled:opacity-50 disabled:cursor-not-allowed h-[56px]"
                          value={formData.vehicleTypeId}
                          onChange={e => setFormData({...formData, vehicleTypeId: e.target.value})}
                        >
                          <option value="">-- Selecciona --</option>
                          {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {formData.vehicleTypeId && (
                      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary">local_shipping</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">Configuración Logística Aplicada</p>
                          <p className="text-xs text-on-surface-variant font-medium mt-1">
                            Este vehículo tiene una capacidad base de <span className="text-primary font-bold">{vehicles.find(v => v.id.toString() === formData.vehicleTypeId)?.base_boxes} cajas</span>. 
                            El sistema calculará su tiempo de muelle proporcional a la carga reportada.
                          </p>
                        </div>
                      </div>
                    )}

                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-xs font-bold uppercase tracking-wider text-primary/50 block mb-2">Nombre del Transportador</label>
                       <Input 
                         placeholder="Nombre del conductor"
                         value={formData.driverName}
                         onChange={e => setFormData({...formData, driverName: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="text-xs font-bold uppercase tracking-wider text-primary/50 block mb-2">Celular / Teléfono</label>
                       <Input 
                         placeholder="Número móvil"
                         type="tel"
                         value={formData.driverPhone}
                         onChange={e => setFormData({...formData, driverPhone: e.target.value})}
                       />
                     </div>
                   </div>
                   
                 </div>
                 <Button className="w-full mt-6" onClick={handleNextStep} disabled={!isStep1Valid}>Siguiente Paso</Button>
               </div>
             )}

             {step === 2 && (
               <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                 <h2 className="text-2xl font-black font-headline">Órdenes a Cargar</h2>
                 <p className="text-sm text-on-surface-variant font-medium">Asocia todas las órdenes de compra (OC) que vengan consolidadas dentro del vehículo con placas {formData.licensePlate}</p>
                 
                 <div className="space-y-4">
                   {purchaseOrders.map((po, idx) => (
                     <div key={idx} className="flex gap-4 items-end bg-surface-container-low p-4 rounded-xl border border-surface-container relative">
                       <div className="flex-1">
                         <label className="text-[10px] font-bold uppercase tracking-wider text-primary/50 block mb-1">Orden de Compra {idx + 1}</label>
                         <Input 
                           placeholder="OC-00000"
                           value={po.poNumber}
                           onChange={e => handleOrderChange(idx, 'poNumber', e.target.value)}
                         />
                       </div>
                       <div className="w-[120px]">
                         <label className="text-[10px] font-bold uppercase tracking-wider text-primary/50 block mb-1">Cajas</label>
                         <Input 
                           type="number"
                           placeholder="0"
                           value={po.boxCount}
                           onChange={e => handleOrderChange(idx, 'boxCount', e.target.value)}
                         />
                       </div>
                       {purchaseOrders.length > 1 && (
                         <Button 
                           variant="ghost" 
                           onClick={() => handleRemoveOrder(idx)} 
                           className="text-error hover:bg-error-container w-10 h-10 p-0 rounded-full flex-shrink-0"
                         >
                           <span className="material-symbols-outlined text-lg">close</span>
                         </Button>
                       )}
                     </div>
                   ))}
                   
                   <Button variant="secondary" onClick={handleAddOrder} className="w-full border-dashed border-2 hover:bg-secondary-container">
                     <span className="material-symbols-outlined mr-2">add_circle</span>
                     Añadir Otra Orden
                   </Button>
                 </div>

                 <div className="flex justify-between items-center bg-primary-fixed/30 p-4 rounded-xl">
                   <p className="text-xs font-bold uppercase text-on-primary-fixed-variant">Cajas Totales del Vehículo</p>
                   <p className="text-2xl font-black text-primary">{getTotalBoxCount()}</p>
                 </div>

                 <div className="flex gap-4 mt-6">
                   <Button variant="secondary" onClick={handlePrevStep} className="flex-1">Atrás</Button>
                   <Button onClick={handleNextStep} disabled={!isStep2Valid} className="flex-1">Programar Turno</Button>
                 </div>
               </div>
             )}

             {step === 3 && (
               <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                 <h2 className="text-2xl font-black font-headline">Reserva de Muelle</h2>
                 
                 <div>
                   <label className="text-xs font-bold uppercase tracking-wider text-primary/50 block mb-2">Selecciona un día para la entrega</label>
                   <Input 
                     type="date"
                     value={formData.scheduledDate}
                     onChange={e => setFormData({...formData, scheduledDate: e.target.value})}
                   />
                 </div>

                 {formData.scheduledDate && (
                    <div className="pt-4 border-t border-surface-container border-dashed animate-in fade-in">
                       <div className="bg-white/50 backdrop-blur-md rounded-2xl p-6 mb-6 border border-primary/10 space-y-4">
                         <div className="flex justify-between items-center">
                           <h3 className="text-sm font-black font-headline uppercase tracking-wider text-primary/60">Estimación de Duración</h3>
                           <span className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase">Cálculo en vivo</span>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Cargas Reportadas</p>
                              <p className="text-lg font-black text-on-surface">{getTotalBoxCount()} <span className="text-xs font-bold opacity-40">cajas</span></p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Capacidad {vehicles.find(v => v.id.toString() === formData.vehicleTypeId)?.name}</p>
                              <p className="text-lg font-black text-on-surface">{vehicles.find(v => v.id.toString() === formData.vehicleTypeId)?.base_boxes} <span className="text-xs font-bold opacity-40">cajas</span></p>
                            </div>
                         </div>

                         <div className="pt-4 border-t border-surface-container/50 flex items-end justify-between">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-primary uppercase">Tiempo en Muelle Reservado</p>
                              <div className="flex items-baseline gap-2">
                                <p className="text-4xl font-black font-headline text-primary tracking-tighter">{durationInfo.buffer}</p>
                                <p className="text-sm font-bold text-primary/60">Minutos</p>
                              </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1">Incluye tiempos de:</p>
                               <div className="flex gap-2 justify-end">
                                  <span className="text-[9px] font-bold px-2 py-1 bg-surface-container rounded-md">Descarga</span>
                                  <span className="text-[9px] font-bold px-2 py-1 bg-surface-container rounded-md">Maniobra</span>
                                  <span className="text-[9px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-md">Buffer</span>
                               </div>
                            </div>
                         </div>
                       </div>

                       <h3 className="text-sm font-black font-headline mb-4 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                         Franjas Disponibles Basadas en Disponibilidad Real
                       </h3>
                       {loading ? (
                        <div className="text-sm rounded-lg bg-surface-container p-4 text-center font-bold text-on-surface-variant animate-pulse">Consultando el motor logístico...</div>
                      ) : availableSlots.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {availableSlots.map(time => (
                            <div 
                              key={time} 
                              onClick={() => setFormData({...formData, scheduledTime: time})}
                              className={`p-3 text-center rounded-xl text-sm font-bold cursor-pointer transition-all border ${formData.scheduledTime === time ? 'bg-primary border-primary text-white scale-105 shadow-xl shadow-primary/20' : 'bg-surface-container-low border-surface-container hover:border-primary/50 hover:bg-surface-container'}`}
                            >
                              {time}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm rounded-lg bg-error/10 p-4 font-bold text-error border border-error/20 flex flex-col items-center">
                           <span className="material-symbols-outlined text-[30px] mb-2">event_busy</span>
                           <p>Sin disponibilidad completa en este día.</p>
                           <p className="text-xs font-medium opacity-80 text-center mt-1">El nivel de ocupación superaría nuestros muelles operacionales. Elige otra fecha.</p>
                        </div>
                      )}
                   </div>
                 )}

                 <div className="flex gap-4 mt-6">
                   <Button variant="secondary" onClick={handlePrevStep} className="flex-1">Atrás</Button>
                   <Button 
                     onClick={handleSubmit} 
                     disabled={!formData.scheduledTime || loading} 
                     className="flex-1 bg-tertiary-fixed text-tertiary-fixed-dim hover:bg-tertiary-fixed/80"
                   >
                     {loading ? 'Procesando...' : 'Confirmar Cita'}
                   </Button>
                 </div>
               </div>
             )}

             {step === 4 && (
               <div className="text-center space-y-6 py-8 animate-in zoom-in-95 duration-500">
                 <div className="w-20 h-20 bg-tertiary-fixed rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-tertiary/20 animate-bounce">
                   <span className="material-symbols-outlined text-[40px] text-tertiary">check_circle</span>
                 </div>
                 <div>
                   <h2 className="text-3xl font-black font-headline text-on-surface">Vehículo Agendado Exitosamente</h2>
                   <p className="text-primary/60 font-medium mt-2 max-w-sm mx-auto">Tu maniobra ha sido aprobada e insertada en el tablón CEDI.</p>
                 </div>
                 
                 <div className="bg-surface-container-low p-6 rounded-2xl text-left inline-block w-full max-w-sm border border-surface-container mt-6">
                   <div className="flex justify-between border-b pb-2 mb-2 border-surface-container">
                     <span className="text-xs font-bold uppercase text-primary/40">Placa</span>
                     <span className="font-bold text-lg">{formData.licensePlate}</span>
                   </div>
                   <div className="flex justify-between border-b pb-2 mb-2 border-surface-container">
                     <span className="text-xs font-bold uppercase text-primary/40">Fecha Reserva</span>
                     <span className="font-bold text-sm text-tertiary">{formData.scheduledDate} a las {formData.scheduledTime}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-xs font-bold uppercase text-primary/40">Órdenes a entregar</span>
                     <span className="font-bold text-sm">{purchaseOrders.length} ({getTotalBoxCount()} cajas)</span>
                   </div>
                 </div>
                 
                 <Button 
                   variant="tertiary" 
                   className="mt-8" 
                   onClick={handleResetForAnotherVehicle}
                 >
                   Agendar Otro Vehículo
                 </Button>
               </div>
             )}

           </div>
        </Card>
        
        {/* Footer info visible in steps */}
        {step < 4 && (
          <div className="text-center mt-6 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-primary/30">verified_user</span>
            <p className="text-[10px] text-on-surface-variant/40 max-w-xs leading-relaxed uppercase tracking-wider font-bold">La programación logistica evita demoras in-situ al reservar su bahia pre-calculada</p>
          </div>
        )}
      </div>

    </div>
  )
}
