"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray, SubmitHandler, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { createClient } from "@/lib/supabase/client"
import { runSchedulingEngine } from "@/lib/services/scheduling-engine"
import type { VehicleType, Environment, ProductCategory, AvailableSlot, CapacityCheckResult, SchedulingRule } from "@/types"

interface ConfirmedAppointment {
  id: number;
  appointment_number: string;
  license_plate: string;
  driver_name: string;
  scheduled_date: string;
  scheduled_time: string;
  environment_id: number;
  requires_extended_hours: boolean;
  status: string;
}

const appointmentSchema = z.object({
  company_name: z.string().min(3, "Mínimo 3 caracteres"),
  vehicle_type_id: z.coerce.number().min(1, "Tipo de vehículo requerido"),
  environment_id: z.coerce.number().min(1, "Ambiente requerido"),
  category_id: z.coerce.number().min(1, "Categoría requerida"),
  license_plate: z.string().min(3, "Placa requerida"),
  driver_name: z.string().min(5, "Nombre completo"),
  driver_phone: z.string().min(7, "Teléfono de contacto"),
  purchase_orders: z.array(
    z.object({
      po_number: z.string().min(3, "Mínimo 3 caracteres"),
      box_count: z.coerce.number().min(1, "Mínimo 1 caja")
    })
  ).min(1, "Agrega al menos una orden"),
  scheduled_date: z.string().min(1, "Fecha requerida"),
  scheduled_time: z.string().min(1, "Hora requerida"),
})

type AppointmentForm = z.infer<typeof appointmentSchema>

export function SupplierForm() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmedAppointment, setConfirmedAppointment] = useState<ConfirmedAppointment | null>(null)
  const supabase = createClient()

  // Reference data
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loadingRef, setLoadingRef] = useState(true)

  // Scheduling engine results
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [capacity, setCapacity] = useState<CapacityCheckResult | null>(null)
  const [matchedRule, setMatchedRule] = useState<SchedulingRule | null>(null)
  const [estimatedDuration, setEstimatedDuration] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    trigger,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema) as Resolver<AppointmentForm>,
    defaultValues: {
      scheduled_date: new Date().toISOString().split('T')[0],
      purchase_orders: [{ po_number: "", box_count: 0 }],
      vehicle_type_id: 0,
      environment_id: 0,
      category_id: 0
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: "purchase_orders" })

  const watchDate = watch("scheduled_date")
  const watchEnvId = watch("environment_id")
  const watchVehicleTypeId = watch("vehicle_type_id")
  const watchCategoryId = watch("category_id")

  // Load reference data
  useEffect(() => {
    async function load() {
      const [vRes, eRes, cRes] = await Promise.all([
        supabase.from('vehicle_types').select('*').eq('is_active', true).order('name'),
        supabase.from('environments').select('*').eq('is_active', true).order('id'),
        supabase.from('product_categories').select('*').eq('is_active', true).order('id'),
      ])
      if (vRes.data) setVehicleTypes(vRes.data)
      if (eRes.data) setEnvironments(eRes.data)
      if (cRes.data) setCategories(cRes.data)
      setLoadingRef(false)
    }
    load()
  }, [supabase])

  // Calculate total boxes from POs
  const totalBoxes = watch("purchase_orders").reduce((sum, po) => sum + (Number(po.box_count) || 0), 0)

  // Run scheduling engine when date changes or step 3 is reached
  useEffect(() => {
    if (step !== 3 || !watchDate || !watchEnvId || totalBoxes === 0) return

    async function calculate() {
      setLoadingSlots(true)
      setSelectedSlot(null)
      setValue("scheduled_time", "")

      const result = await runSchedulingEngine({
        date: watchDate,
        environmentId: Number(watchEnvId),
        vehicleTypeId: Number(watchVehicleTypeId) || null,
        categoryId: Number(watchCategoryId) || null,
        totalBoxes,
      })

      setSlots(result.slots)
      setCapacity(result.capacity)
      setMatchedRule(result.rule)
      setEstimatedDuration(result.durationMinutes)
      setLoadingSlots(false)
    }
    calculate()
  }, [step, watchDate, watchEnvId, watchVehicleTypeId, watchCategoryId, totalBoxes, setValue])

  const handleSelectSlot = (slot: AvailableSlot) => {
    setSelectedSlot(slot)
    setValue("scheduled_time", slot.time + ":00")
  }

  const nextStep = async () => {
    let fieldsToValidate: (keyof AppointmentForm)[] = []
    if (step === 1) fieldsToValidate = ["company_name", "vehicle_type_id", "environment_id", "category_id", "license_plate", "driver_name", "driver_phone"]
    if (step === 2) fieldsToValidate = ["purchase_orders"]
    
    const isValid = await trigger(fieldsToValidate)
    if (isValid) setStep(step + 1)
  }

  const prevStep = () => setStep(step - 1)

  const onSubmit: SubmitHandler<AppointmentForm> = async (data) => {
    if (!selectedSlot) {
      setError("Selecciona un horario disponible.")
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Calculate end time
      const [h, m] = data.scheduled_time.split(':').map(Number)
      const endMin = h * 60 + m + estimatedDuration
      const endH = Math.floor(endMin / 60)
      const endM = endMin % 60
      const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`

      const vehicleType = vehicleTypes.find(v => String(v.id) === String(data.vehicle_type_id))

      const { data: newAppointment, error: apptError } = await supabase
        .from('appointments')
        .insert({
          company_name: data.company_name,
          vehicle_type: vehicleType?.name || 'Desconocido',
          vehicle_type_id: vehicleType?.id || data.vehicle_type_id,
          license_plate: data.license_plate,
          driver_name: data.driver_name,
          driver_phone: data.driver_phone,
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time,
          scheduled_end_time: endTimeStr,
          estimated_duration_minutes: estimatedDuration,
          dock_id: selectedSlot.dock_id,
          environment_id: data.environment_id,
          category_id: data.category_id,
          scheduling_rule_id: matchedRule?.id || null,
          requires_extended_hours: capacity?.requiresExtendedHours || false,
          status: 'PENDIENTE',
          box_count: totalBoxes,
        })
        .select('*')
        .single()

      if (apptError) {
        if (apptError.code === '23505') {
          throw new Error("Ya existe una cita programada para esta placa en este horario.")
        }
        throw apptError
      }

      const ordersToInsert = data.purchase_orders.map(po => ({
        appointment_id: newAppointment.id,
        po_number: po.po_number,
        box_count: po.box_count
      }))

      const { error: poError } = await supabase
        .from('appointment_purchase_orders')
        .insert(ordersToInsert)

      if (poError) throw poError
      
      setConfirmedAppointment(newAppointment)
      setSuccess(true)
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Ocurrió un error al agendar la cita")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    const company = getValues("company_name")
    setSuccess(false)
    setConfirmedAppointment(null)
    setStep(1)
    setSlots([])
    setCapacity(null)
    setMatchedRule(null)
    setSelectedSlot(null)
    reset({
      company_name: company || "",
      purchase_orders: [{ po_number: "", box_count: 0 }],
      scheduled_date: new Date().toISOString().split('T')[0],
      driver_name: "",
      driver_phone: "",
      license_plate: "",
      scheduled_time: ""
    })
  }

  if (success && confirmedAppointment) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window?.location?.origin || ""}/checkin?appt=${confirmedAppointment.appointment_number}&plate=${confirmedAppointment.license_plate}`)}`

    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="bg-white dark:bg-surface-elevated rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-surface-container-highest/20 print:p-0 print:shadow-none print:border-0" id="voucher-printable">
          {/* Header del Voucher */}
          <div className="bg-kinetic-gradient h-32 relative flex items-center justify-center">
            <div className="absolute top-0 left-0 w-full h-full bg-black/10 backdrop-blur-[2px]" />
            <div className="relative z-10 text-center text-white">
              <h1 className="text-3xl font-black font-headline tracking-tighter">CONFIRMACIÓN</h1>
              <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80">Cita de Abastecimiento Isimo</p>
            </div>
            {/* Círculos decorativos de ticket */}
            <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-surface rounded-full shadow-inner" />
            <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-surface rounded-full shadow-inner" />
          </div>

          <div className="p-8 space-y-8">
            {/* Sección superior: ID y QR */}
            <div className="flex flex-col md:flex-row items-center gap-8 border-b border-dashed border-surface-container-highest/40 pb-8">
              <div className="flex-1 text-center md:text-left space-y-2">
                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Número de Cita</p>
                <p className="text-5xl font-black font-headline text-primary tracking-tighter">
                  {confirmedAppointment.appointment_number || "CITA-000"}
                </p>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    confirmedAppointment.requires_extended_hours ? "bg-amber-100 text-amber-700" : "bg-success/10 text-success"
                  )}>
                    {confirmedAppointment.requires_extended_hours ? "Horario Extendido" : "Confirmada"}
                  </span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    {confirmedAppointment.status}
                  </span>
                </div>
              </div>
              
              <div className="p-4 bg-surface-container-low rounded-3xl border border-white flex flex-col items-center gap-2 shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR Check-in" className="w-40 h-40 mix-blend-multiply opacity-90" />
                <p className="text-[8px] font-black uppercase tracking-tighter text-on-surface-variant/40">Presentar para Check-in</p>
              </div>
            </div>

            {/* Grid de Detalles Operativos */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { label: 'Vehículo', value: confirmedAppointment.license_plate, icon: 'local_shipping' },
                { label: 'Chofer', value: confirmedAppointment.driver_name, icon: 'person' },
                { label: 'Fecha', value: confirmedAppointment.scheduled_date, icon: 'calendar_today' },
                { label: 'Hora Arribo', value: confirmedAppointment.scheduled_time?.substring(0, 5), icon: 'schedule', color: 'text-primary' },
                { label: 'Muelle', value: selectedSlot?.dock_name || "Asignado", icon: 'dock', color: 'text-tertiary' },
                { label: 'Ambiente', value: environments.find(e => e.id === Number(confirmedAppointment.environment_id))?.display_name, icon: 'pin_drop' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1 group">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40">{item.icon}</span>
                    <p className="text-[10px] font-black uppercase text-on-surface-variant/40 tracking-wider font-headline">{item.label}</p>
                  </div>
                  <p className={cn("text-sm font-black truncate", item.color || "text-on-surface")}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Aviso de Seguridad */}
            <div className="bg-surface-container-highest/20 p-5 rounded-3xl flex items-start gap-4 border border-surface-container-highest/10">
              <span className="material-symbols-outlined text-on-surface-variant/60">security</span>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-tighter text-on-surface-variant">Protocolo Isimo</p>
                <p className="text-xs text-on-surface-variant/70 leading-relaxed font-medium">
                  Debe presentarse con EPP reglamentario. Si llega más de 5 minutos tarde, su turno quedará como <strong>Tardío</strong> y se procesará según disponibilidad.
                </p>
              </div>
            </div>
          </div>

          {/* Pie del Voucher decorativo */}
          <div className="h-4 bg-surface-container-highest flex gap-2 overflow-hidden justify-center items-center">
             {Array.from({ length: 40 }).map((_, i) => (
               <div key={i} className="w-2 h-2 rounded-full bg-white opacity-50 shrink-0" />
             ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-4 print:hidden">
          <Button 
            variant="secondary" 
            size="lg" 
            className="flex-1 rounded-2xl h-16 shadow-elevated gap-3 bg-white"
            onClick={() => window.print()}
          >
            <span className="material-symbols-outlined">print</span>
            Imprimir o Guardar PDF
          </Button>
          <Button 
            variant="primary" 
            size="lg" 
            className="flex-1 rounded-2xl h-16 shadow-elevated gap-3"
            onClick={handleReset}
          >
            <span className="material-symbols-outlined">add_circle</span>
            Agendar Otro Vehículo
          </Button>
        </div>

        <p className="text-center text-on-surface-variant/40 text-[10px] font-bold uppercase tracking-widest animate-pulse">
          Confidencial — Reservado para Personal Logístico
        </p>
      </div>
    )
  }

  return (
    <Card variant="elevated" className="max-w-2xl mx-auto overflow-hidden">
      <div className="h-2 bg-surface-container-highest w-full overflow-hidden">
        <div 
          className="h-full bg-kinetic-gradient transition-all duration-500 ease-out" 
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <CardHeader className="pb-2">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-primary/60">Paso {step} de 3</p>
            <CardTitle className="text-3xl">
              {step === 1 && "Datos del Vehículo"}
              {step === 2 && "Órdenes a Cargar"}
              {step === 3 && "Programación Inteligente"}
            </CardTitle>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-4xl font-black text-surface-container-highest/50 font-headline leading-none">
              0{step}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3 animate-in fade-in duration-300">
              <span className="material-symbols-outlined">warning</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <Input 
                label="Empresa / Proveedor" 
                placeholder="Nombre de la empresa" 
                icon="factory"
                error={errors.company_name?.message}
                {...register("company_name")}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">Ambiente</label>
                  <select
                    className="flex w-full rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 h-[56px] appearance-none"
                    {...register("environment_id")}
                    disabled={loadingRef}
                  >
                    <option value="">-- Seleccionar --</option>
                    {environments.map(e => (
                      <option key={e.id} value={e.id}>{e.display_name}</option>
                    ))}
                  </select>
                  {errors.environment_id && <p className="text-xs text-error mt-1">{errors.environment_id.message}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">Categoría de Producto</label>
                  <select
                    className="flex w-full rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 h-[56px] appearance-none"
                    {...register("category_id")}
                    disabled={loadingRef}
                  >
                    <option value="">-- Seleccionar --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.display_name}</option>
                    ))}
                  </select>
                  {errors.category_id && <p className="text-xs text-error mt-1">{errors.category_id.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-2 block">Tipo de Vehículo</label>
                  <select
                    className="flex w-full rounded-xl border border-surface-container bg-surface-container-low/10 text-on-surface p-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 h-[56px] appearance-none"
                    {...register("vehicle_type_id")}
                    disabled={loadingRef}
                  >
                    <option value="">-- Seleccionar --</option>
                    {vehicleTypes.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  {errors.vehicle_type_id && <p className="text-xs text-error mt-1">{errors.vehicle_type_id.message}</p>}
                </div>
                <Input 
                  label="Placa de Vehículo" 
                  placeholder="ABC-123" 
                  icon="format_list_numbered"
                  error={errors.license_plate?.message}
                  {...register("license_plate")}
                />
              </div>
              <Input 
                label="Nombre del Conductor" 
                placeholder="Nombre completo" 
                icon="person_pin_circle"
                error={errors.driver_name?.message}
                {...register("driver_name")}
              />
              <Input 
                label="Teléfono del Conductor" 
                placeholder="300 000 0000" 
                icon="phone_iphone"
                error={errors.driver_phone?.message}
                {...register("driver_phone")}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-sm text-on-surface-variant mb-4">Agrega las Órdenes de Compra (OCs) asociadas a este viaje y sus cantidades respectivas de cajas.</p>
              
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 md:gap-4 items-start p-4 bg-surface-container rounded-lg border border-surface-container-highest/20 relative group">
                  <div className="col-span-12 md:col-span-6">
                    <Input 
                      label={`Orden de Compra ${index + 1}`}
                      placeholder="Ej: PO-987654" 
                      icon="receipt_long"
                      error={errors.purchase_orders?.[index]?.po_number?.message}
                      {...register(`purchase_orders.${index}.po_number` as const)}
                    />
                  </div>
                  <div className="col-span-10 md:col-span-5">
                    <Input 
                      label="Cajas" 
                      type="number" 
                      placeholder="0" 
                      icon="inventory_2"
                      error={errors.purchase_orders?.[index]?.box_count?.message}
                      {...register(`purchase_orders.${index}.box_count` as const)}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1 pt-[28px] text-right">
                    {fields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => remove(index)}
                        className="text-error hover:bg-error-container hover:text-on-error-container w-10 h-10 p-0"
                        title="Eliminar orden"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Total boxes summary */}
              <div className="bg-primary-fixed/20 p-4 rounded-xl flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface">Total de Cajas</span>
                <span className="text-2xl font-black font-headline text-primary">{totalBoxes.toLocaleString()}</span>
              </div>

              {errors.purchase_orders?.root && (
                <p className="text-sm text-error font-medium">{errors.purchase_orders.root.message}</p>
              )}

              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => append({ po_number: "", box_count: 0 })}
                className="w-full mt-2 border-dashed border-2 bg-transparent hover:bg-secondary-container"
              >
                <span className="material-symbols-outlined mr-2">add</span>
                Agregar Variante Carga
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Capacity Alert */}
              {capacity && !capacity.withinNormal && (
                <div className={`p-4 rounded-xl flex items-start gap-3 ${capacity.overCapacity ? 'bg-error-container text-on-error-container' : 'bg-amber-100 text-amber-900'}`}>
                  <span className="material-symbols-outlined mt-0.5">{capacity.overCapacity ? 'error' : 'warning'}</span>
                  <div className="space-y-1">
                    <p className="text-sm font-bold">{capacity.overCapacity ? '⚠️ Sobrecupo Crítico' : '🟡 Horario Extendido Requerido'}</p>
                    <p className="text-xs leading-relaxed">
                      {capacity.overCapacity 
                        ? `Se han superado los ${capacity.extendedLimit.toLocaleString()} cajas del límite extendido (actual: ${capacity.currentBoxes.toLocaleString()}). El agendamiento continúa pero se alertará al equipo CEDI.`
                        : `Se supera el límite normal de ${capacity.normalLimit.toLocaleString()} cajas (actual: ${capacity.currentBoxes.toLocaleString()}). La cita podría requerir horario extendido.`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Engine Result Info */}
              {matchedRule && (
                <div className="bg-surface-container-low p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary">bolt</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Regla: {matchedRule.name}</p>
                      <p className="text-[10px] text-on-surface-variant/60">Duración estimada del muelle: {estimatedDuration} min ({(estimatedDuration / 60).toFixed(1)}h)</p>
                    </div>
                  </div>
                  <span className="text-lg font-black font-headline text-tertiary">{estimatedDuration} min</span>
                </div>
              )}

              {/* Date Picker */}
              <Input 
                label="Fecha de Entrega" 
                type="date" 
                icon="calendar_month"
                error={errors.scheduled_date?.message}
                {...register("scheduled_date")}
              />

              {/* Available Slots Grid */}
              <div>
                <label className="text-[10px] font-black tracking-widest uppercase text-primary/60 mb-3 block">
                  Horarios Disponibles
                </label>
                
                {loadingSlots ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse bg-surface-container rounded-xl" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="p-8 text-center bg-surface-container rounded-xl">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">event_busy</span>
                    <p className="text-sm font-bold text-on-surface-variant/50">Sin disponibilidad para esta fecha</p>
                    <p className="text-xs text-on-surface-variant/40 mt-1">Intenta seleccionar otra fecha o contacta al equipo CEDI.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          selectedSlot?.time === slot.time && selectedSlot?.dock_id === slot.dock_id
                            ? 'border-primary bg-primary-fixed text-on-primary-fixed shadow-elevated'
                            : 'border-surface-container bg-white hover:border-primary/30 hover:bg-primary-fixed/20'
                        }`}
                      >
                        <p className="font-black font-headline text-lg">{slot.time}</p>
                        <p className="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider">{slot.dock_name}</p>
                      </button>
                    ))}
                  </div>
                )}

                {errors.scheduled_time && <p className="text-xs text-error mt-2">{errors.scheduled_time.message}</p>}
              </div>

              {/* Info box */}
              <div className="p-4 bg-primary-fixed/20 rounded-2xl border border-primary-fixed/50 flex items-start gap-4">
                <span className="material-symbols-outlined text-primary mt-1">info</span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-on-primary-fixed">Importante</p>
                  <p className="text-xs text-on-primary-fixed-variant leading-relaxed">
                    Asegúrate de llegar 30 minutos antes de la hora programada. El incumplimiento del horario puede resultar en la cancelación del turno.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-surface-container-highest/30">
            {step > 1 && (
              <Button type="button" variant="tertiary" size="lg" className="flex-1" onClick={prevStep}>
                Atrás
              </Button>
            )}
            
            {step < 3 ? (
              <Button type="button" variant="primary" size="lg" className="flex-1" onClick={nextStep}>
                Continuar
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="lg" className="flex-1" isLoading={loading} disabled={!selectedSlot}>
                Finalizar Agendamiento
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
