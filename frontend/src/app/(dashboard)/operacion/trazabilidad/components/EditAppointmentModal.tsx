"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Appointment, VehicleType, AppointmentStatus } from "@/types"

export function EditAppointmentModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment,
  vehicleTypes
}: {
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  appointment: Appointment | null;
  vehicleTypes: VehicleType[];
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    license_plate: '',
    driver_name: '',
    driver_phone: '',
    vehicle_type_id: '',
    status: '' as AppointmentStatus | '',
  })
  const supabase = createClient()

  useEffect(() => {
    if (appointment) {
      setFormData({
        company_name: appointment.company_name || '',
        license_plate: appointment.license_plate || '',
        driver_name: appointment.driver_name || '',
        driver_phone: appointment.driver_phone || '',
        vehicle_type_id: appointment.vehicle_type_id?.toString() || '',
        status: appointment.status,
      })
    }
  }, [appointment])

  if (!isOpen || !appointment) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const selectedVehicle = vehicleTypes.find(v => v.id.toString() === formData.vehicle_type_id)

      // Calculate changed fields
      const changed_fields: Record<string, unknown> = {}
      if (appointment.company_name !== formData.company_name) changed_fields.company_name = { old: appointment.company_name, new: formData.company_name }
      if (appointment.license_plate !== formData.license_plate) changed_fields.license_plate = { old: appointment.license_plate, new: formData.license_plate }
      if (appointment.driver_name !== formData.driver_name) changed_fields.driver_name = { old: appointment.driver_name, new: formData.driver_name }
      if (appointment.driver_phone !== formData.driver_phone) changed_fields.driver_phone = { old: appointment.driver_phone, new: formData.driver_phone }
      if (appointment.vehicle_type_id !== parseInt(formData.vehicle_type_id)) changed_fields.vehicle_type_id = { old: appointment.vehicle_type_id, new: formData.vehicle_type_id }
      if (appointment.status !== formData.status) changed_fields.status = { old: appointment.status, new: formData.status }
      
      if (Object.keys(changed_fields).length === 0) {
        onClose()
        setLoading(false)
        return
      }

      // Update appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          company_name: formData.company_name,
          license_plate: formData.license_plate,
          driver_name: formData.driver_name,
          driver_phone: formData.driver_phone,
          vehicle_type_id: parseInt(formData.vehicle_type_id),
          vehicle_type: selectedVehicle?.name || appointment.vehicle_type,
          status: formData.status
        })
        .eq('id', appointment.id)

      if (updateError) {
        throw new Error(`Error al actualizar la base de datos: ${updateError.message}`)
      }

      // Record Audit Log (Non-blocking)
      const { error: auditError } = await supabase.from('appointment_audit_log').insert({
        appointment_id: appointment.id,
        user_id: user?.id,
        action: 'EDIT',
        changed_fields: changed_fields,
        notes: 'Actualización de datos generales'
      })

      if (auditError) {
        console.warn("No se pudo registrar la auditoría del cambio:", auditError.message)
      }

      alert("Cambios guardados correctamente.")
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.error("Error editing appointment:", error)
      alert(`Error al guardar los cambios: ${error.message || "Error desconocido"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">edit</span>
            </div>
            <div>
              <h3 className="text-xl font-black font-headline">Editar Información</h3>
              <p className="text-sm text-on-surface-variant">Corrige errores de tipeo del transportador</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Empresa Transportadora" 
              required 
              value={formData.company_name}
              onChange={e => setFormData({...formData, company_name: e.target.value})}
            />
            <Input 
              label="Placa del Vehículo" 
              required
              className="uppercase"
              value={formData.license_plate}
              onChange={e => setFormData({...formData, license_plate: e.target.value.toUpperCase()})}
            />
            
            <Input 
              label="Nombre Conductor" 
              required 
              value={formData.driver_name}
              onChange={e => setFormData({...formData, driver_name: e.target.value})}
            />
            <Input 
              label="Teléfono Conductor" 
              type="tel"
              required 
              value={formData.driver_phone}
              onChange={e => setFormData({...formData, driver_phone: e.target.value})}
            />

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                Tipo de Vehículo
              </label>
              <select 
                title="Seleccionar tipo de vehículo"
                className="w-full h-12 px-4 rounded-xl border-2 border-surface-container bg-surface/50 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-medium appearance-none"
                required
                value={formData.vehicle_type_id}
                onChange={e => setFormData({...formData, vehicle_type_id: e.target.value})}
              >
                <option value="">Seleccione un tipo</option>
                {vehicleTypes.map(v => (
                  <option key={v.id} value={v.id.toString()}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                Estado de la Cita
              </label>
              <select 
                title="Cambiar estado"
                className="w-full h-12 px-4 rounded-xl border-2 border-surface-container bg-surface/50 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold appearance-none"
                required
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as AppointmentStatus})}
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN_PORTERIA">EN PORTERÍA</option>
                <option value="EN_MUELLE">EN MUELLE</option>
                <option value="DESCARGANDO">DESCARGANDO</option>
                <option value="FINALIZADO">FINALIZADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading} type="button">Cancelar</Button>
            <Button className="flex-1" disabled={loading} type="submit">
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
