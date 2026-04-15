"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { VehicleType } from "@/types"

export function WalkInModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  vehicleTypes 
}: {
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  vehicleTypes: VehicleType[];
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    license_plate: '',
    driver_name: '',
    driver_phone: '',
    vehicle_type_id: '',
    po_number: '',
    box_count: ''
  })
  const supabase = createClient()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const sanitizedPlate = formData.license_plate.replace(/[^A-Za-z0-9]/g, '')
    if (sanitizedPlate.length !== 6) {
      alert("La placa debe tener exactamente 6 caracteres y no contener guiones.")
      return
    }

    setLoading(true)

    try {
      const selectedVehicle = vehicleTypes.find(v => v.id.toString() === formData.vehicle_type_id)
      
      // Get current user id
      const { data: { user } } = await supabase.auth.getUser()

      // Inserta la cita como walk-in
      const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .insert({
          company_name: formData.company_name,
          license_plate: sanitizedPlate.toLowerCase(),
          driver_name: formData.driver_name.trim().toLowerCase(),
          driver_phone: formData.driver_phone,
          vehicle_type_id: parseInt(formData.vehicle_type_id),
          vehicle_type: selectedVehicle?.name || '',
          status: 'EN_PORTERIA', // Ingresa directo a portería
          is_walk_in: true,
          scheduled_date: new Date().toISOString().split('T')[0], // Se asigna la fecha actual
          scheduled_time: new Date().toTimeString().split(' ')[0], // y hora actual (o requeriría logica extra, pero as is walk-in it doesn't matter much)
          // po_number is optional at top level or we can save it to appointment_purchase_orders
        })
        .select()
        .single()

      if (apptError) throw apptError

      // Insert PO if provided
      if (formData.po_number && appt) {
        await supabase.from('appointment_purchase_orders').insert({
          appointment_id: appt.id,
          po_number: formData.po_number,
          box_count: parseInt(formData.box_count) || 1
        })
      }

      // Record Audit Log
      await supabase.from('appointment_audit_log').insert({
        appointment_id: appt.id,
        user_id: user?.id,
        action: 'WALK_IN',
        notes: 'Registro Ingreso Express'
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error creating walk-in:", error)
      alert("Error al registrar el ingreso express.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <div>
              <h3 className="text-xl font-black font-headline">Ingreso Express</h3>
              <p className="text-sm text-on-surface-variant">Llegada sin cita previa (Ingresa a Portería Directamente)</p>
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
              className="capitalize"
              value={formData.driver_name}
              onChange={e => setFormData({...formData, driver_name: e.target.value})}
            />
            <Input 
              label="Teléfono Conductor" 
              type="number"
              required 
              value={formData.driver_phone}
              onChange={e => setFormData({...formData, driver_phone: e.target.value})}
            />
            <Input 
              label="Cédula Conductor (Opcional)" 
              type="number"
              value={formData.driver_id_card}
              onChange={e => setFormData({...formData, driver_id_card: e.target.value})}
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

            <Input 
              label="No. OC (Opcional)" 
              value={formData.po_number}
              onChange={e => setFormData({...formData, po_number: e.target.value})}
            />
            <Input 
              label="Total Cajas" 
              type="number"
              value={formData.box_count}
              onChange={e => setFormData({...formData, box_count: e.target.value})}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading} type="button">Cancelar</Button>
            <Button className="flex-1 bg-amber-500 hover:bg-amber-600 border-amber-500 hover:border-amber-600 text-white" disabled={loading} type="submit">
              {loading ? 'Registrando...' : 'Registrar Ingreso'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
