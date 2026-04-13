"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

type Step = 'SEARCH' | 'FOUND' | 'NOT_FOUND' | 'SUCCESS' | 'ERROR'

export default function CheckInPage() {
  const [step, setStep] = useState<Step>('SEARCH')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null)
  const [message, setMessage] = useState('')

  // Form Data for "FOUND" state updates
  const [driverName, setDriverName] = useState('')
  const [driverId, setDriverId] = useState('')
  const [licensePlate, setLicensePlate] = useState('')

  // Form Data for "NOT_FOUND" (Walk-in) state
  const [wiCompany, setWiCompany] = useState('')
  const [wiPoNumber, setWiPoNumber] = useState('')
  const [wiBoxes, setWiBoxes] = useState('')

  const supabase = createClient()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('lookup_appointment_for_check_in', {
        p_search_term: searchTerm
      })

      if (error) throw error

      if (data && data.length > 0) {
        setAppointments(data)
        // Auto-select if only one
        if (data.length === 1) {
          handleSelectAppt(data[0])
        }
        setStep('FOUND')
      } else {
        setStep('NOT_FOUND')
        setLicensePlate(searchTerm) // Pre-fill plate with whatever they typed
      }
    } catch (e: unknown) {
      const error = e as { message?: string };
      setStep('ERROR')
      setMessage(error.message || 'Ocurrió un error al buscar')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectAppt = (appt: any) => {
    setSelectedAppt(appt)
    setDriverName(appt.driver_name || '')
    setDriverId(appt.driver_id_card || '')
    setLicensePlate(appt.license_plate || '')
  }

  const handleConfirmArrival = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('process_arrival_check_in', {
        p_appointment_id: selectedAppt?.id,
        p_driver_id_card: driverId,
        p_driver_name: driverName,
        p_license_plate: licensePlate
      })

      if (error) throw error
      
      const { punctuality } = data
      setMessage(`Puntualidad: ${punctuality === 'A_TIEMPO' ? 'A Tiempo' : punctuality === 'TARDE' ? 'Tarde' : 'Temprano'}`)
      setStep('SUCCESS')
    } catch (e: unknown) {
      const error = e as { message?: string };
      alert(error.message || 'Error al registrar llegada')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.rpc('register_walk_in_check_in', {
        p_company_name: wiCompany,
        p_license_plate: licensePlate,
        p_driver_name: driverName,
        p_driver_id_card: driverId,
        p_po_number: wiPoNumber,
        p_box_count: wiBoxes
      })

      if (error) throw error
      
      setMessage('Llegada Registrada como Novedad (Sin Cita)')
      setStep('SUCCESS')
    } catch (e: unknown) {
      const error = e as { message?: string };
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center animate-in fade-in duration-300">
      
      {step === 'SEARCH' && (
        <form onSubmit={handleSearch} className="bg-white p-6 rounded-3xl shadow-float space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
            </div>
            <h2 className="text-2xl font-black font-headline">Registro de Llegada</h2>
            <p className="text-on-surface-variant text-sm">Validación automática de citas programadas.</p>
          </div>

          <div className="space-y-4">
            <Input 
              label="Placa o Número de Orden (O.C.)" 
              placeholder="Ej: ABC-123 o 4500989"
              className="text-center uppercase text-lg font-bold tracking-wider"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              required
            />
            <Button className="w-full h-12 text-lg" disabled={loading} type="submit">
              {loading ? 'Buscando...' : 'Buscar Cita'}
            </Button>
          </div>
        </form>
      )}

      {step === 'FOUND' && selectedAppt && (
        <form onSubmit={handleConfirmArrival} className="bg-white p-6 rounded-3xl shadow-float space-y-6">
          <div className="text-center space-y-1 pb-4 border-b border-outline-variant/30">
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full mb-2 uppercase">Cita Encontrada</span>
            <h2 className="text-xl font-black font-headline text-primary">{selectedAppt?.company_name}</h2>
            <p className="text-sm font-bold opacity-80">
              Hora Programada: {selectedAppt?.scheduled_time?.substring(0,5)}
            </p>
          </div>

          <div className="bg-surface-container-light/50 p-4 rounded-xl border border-outline-variant/30 space-y-4">
            <p className="text-xs font-bold text-center text-on-surface-variant uppercase tracking-wider">Verifique o Actualice si cambió algo</p>
            <Input 
              label="Placa Entrante" 
              className="uppercase"
              value={licensePlate}
              onChange={e => setLicensePlate(e.target.value)}
              required
            />
            <Input 
              label="Cédula Conductor" 
              type="number"
              value={driverId}
              onChange={e => setDriverId(e.target.value)}
              required
            />
            <Input 
              label="Nombre Conductor" 
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('SEARCH')}>Volver</Button>
            <Button className="flex-[2] bg-green-600 hover:bg-green-700 text-white" disabled={loading} type="submit">
              {loading ? 'Procesando...' : 'Confirmar Llegada'}
            </Button>
          </div>
        </form>
      )}

      {step === 'FOUND' && !selectedAppt && (
        <div className="bg-white p-6 rounded-3xl shadow-float space-y-4 text-center">
          <h2 className="font-bold text-lg">Múltiples citas encontradas</h2>
          <p className="text-sm text-on-surface-variant">Seleccione la cita correspondiente</p>
          <div className="space-y-3">
            {appointments.map(a => (
              <button 
                key={a.id} 
                onClick={() => handleSelectAppt(a)}
                className="w-full p-4 border rounded-xl text-left hover:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <div className="font-bold text-primary">{a.company_name}</div>
                <div className="text-sm flex justify-between mt-1">
                  <span>Placa: {a.license_plate}</span>
                  <span className="font-bold">{a.scheduled_time.substring(0,5)}</span>
                </div>
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setStep('SEARCH')}>Cancelar</Button>
        </div>
      )}

      {step === 'NOT_FOUND' && (
         <form onSubmit={handleRegisterWalkIn} className="bg-white p-6 rounded-3xl shadow-float space-y-5">
           <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h2 className="text-xl font-black font-headline text-amber-700">Sin Cita Programada</h2>
            <p className="text-xs text-on-surface-variant">Complete los datos para solicitar ingreso (Standby).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Empresa Transporte / Origen" required value={wiCompany} onChange={e => setWiCompany(e.target.value)} />
            </div>
            <Input label="Placa" required className="uppercase" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} />
            <Input label="Cédula" required type="number" value={driverId} onChange={e => setDriverId(e.target.value)} />
            <div className="col-span-2">
              <Input label="Nombre del Conductor" required value={driverName} onChange={e => setDriverName(e.target.value)} />
            </div>
            <Input label="No. OC (Opcional)" value={wiPoNumber} onChange={e => setWiPoNumber(e.target.value)} />
            <Input label="Total Cajas (Aprox)" type="number" value={wiBoxes} onChange={e => setWiBoxes(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('SEARCH')}>Cancelar</Button>
            <Button className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white" disabled={loading} type="submit">
              {loading ? 'Enviando...' : 'Solicitar Ingreso'}
            </Button>
          </div>
         </form>
      )}

      {step === 'SUCCESS' && (
        <div className="bg-white p-8 rounded-3xl shadow-float text-center space-y-4">
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto animate-in zoom-in spin-in-12 duration-500">
            <span className="material-symbols-outlined text-5xl">check_circle</span>
          </div>
          <h2 className="text-3xl font-black font-headline text-green-700">¡Llegada Exitosa!</h2>
          <p className="text-on-surface-variant font-medium">{message}</p>
          <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 mt-4 text-sm text-left">
            <p><strong>Placa:</strong> {licensePlate.toUpperCase()}</p>
            <p><strong>Conductor:</strong> {driverName}</p>
            <p className="text-xs text-on-surface-variant mt-2 border-t pt-2">Diríjase al patio de maniobras y espere instrucciones por pantalla/megafonía o siga las indicaciones del personal.</p>
          </div>
          <Button className="w-full mt-6" onClick={() => {
            setSearchTerm('')
            setStep('SEARCH')
          }}>
            Regresar al Inicio
          </Button>
        </div>
      )}

      {step === 'ERROR' && (
        <div className="bg-white p-8 rounded-3xl shadow-float text-center space-y-4">
          <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h2 className="text-xl font-black font-headline text-error">Problema de Conexión</h2>
          <p className="text-on-surface-variant">{message}</p>
          <Button variant="secondary" className="w-full mt-4" onClick={() => setStep('SEARCH')}>Intentar de Nuevo</Button>
        </div>
      )}

    </div>
  )
}
