"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { capitalize, normalizeObjectForStorage } from "@/lib/utils"
import type { Appointment } from "@/types"

type Step = 'SEARCH' | 'FOUND' | 'NOT_FOUND' | 'SUCCESS' | 'ERROR'

/**
 * CheckInPage
 * Portal público para que proveedores registren su llegada en la portería del CEDI.
 */
export default function CheckInPage() {
  const [step, setStep] = useState<Step>('SEARCH')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [message, setMessage] = useState('')

  // Form Data for "FOUND" state updates
  const [driverName, setDriverName] = useState('')
  const [driverId, setDriverId] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [licensePlate, setLicensePlate] = useState('')

  // Form Data for "NOT_FOUND" (Walk-in) state
  const [wiCompany, setWiCompany] = useState('')
  const [wiPoNumber, setWiPoNumber] = useState('')
  const [wiBoxes, setWiBoxes] = useState('')

  const supabase = createClient()

  /**
   * Busca citas programadas para el día de hoy basadas en placa o No. OC.
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('lookup_appointment_for_check_in', {
        p_search_term: searchTerm.trim()
      })

      if (error) throw error

      if (data && data.length > 0) {
        setAppointments(data as Appointment[])
        // Selección automática si solo hay una cita
        if (data.length === 1) {
          handleSelectAppt(data[0] as Appointment)
        }
        setStep('FOUND')
      } else {
        setStep('NOT_FOUND')
        setLicensePlate(searchTerm.trim().toUpperCase()) // Pre-llenar placa
      }
    } catch (e: unknown) {
      console.error("Search Error:", e)
      const error = e as { message?: string };
      setStep('ERROR')
      setMessage(error.message || 'No pudimos validar la información en este momento. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Carga los datos de una cita seleccionada en el formulario de confirmación.
   */
  const handleSelectAppt = (appt: Appointment) => {
    setSelectedAppt(appt)
    setDriverName(appt.driver_name || '')
    setDriverId(appt.driver_id_card || '')
    setDriverPhone(appt.driver_phone || '')
    setLicensePlate(appt.license_plate || '')
  }

  /**
   * Procesa el cambio de estado de PENDIENTE a EN_PORTERIA con validación de puntualidad en BD.
   */
  const handleConfirmArrival = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAppt) return

    const sanitizedPlate = licensePlate.replace(/[^A-Za-z0-9]/g, '')
    if (sanitizedPlate.length !== 6) {
      alert("La placa debe tener exactamente 6 caracteres y no contener guiones. Ej: ABC123")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('process_arrival_check_in', normalizeObjectForStorage({
        p_appointment_id: selectedAppt.id,
        p_driver_id_card: driverId.trim(),
        p_driver_name: driverName.trim(),
        p_driver_phone: driverPhone.trim(),
        p_license_plate: licensePlate.trim().toUpperCase()
      }))

      if (error) throw error
      
      const { punctuality } = data as { punctuality: string }
      const punctualityLabels: Record<string, string> = {
        'A_TIEMPO': '¡A Tiempo!',
        'TARDE': 'Llegada Tarde',
        'TEMPRANO': 'Llegada Anticipada'
      }

      setMessage(`Registro de llegada completado. Puntualidad: ${punctualityLabels[punctuality] || punctuality}`)
      setStep('SUCCESS')
    } catch (e: unknown) {
      console.error("Process Arrival Error:", e)
      const error = e as { message?: string };
      alert(error.message || 'Error al registrar llegada. Por favor avise en portería.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Registra un vehículo que llega sin cita previa (Walk-in).
   */
  const handleRegisterWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()

    const sanitizedPlate = licensePlate.replace(/[^A-Za-z0-9]/g, '')
    if (sanitizedPlate.length !== 6) {
      alert("La placa debe tener exactamente 6 caracteres y no contener guiones. Ej: ABC123")
      return
    }

    if (!wiPoNumber.trim()) {
      alert("La Orden de Compra (OC) es obligatoria para ingresos sin cita.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('register_walk_in_check_in', normalizeObjectForStorage({
        p_company_name: wiCompany.trim(),
        p_license_plate: licensePlate.trim().toUpperCase(),
        p_driver_name: driverName.trim(),
        p_driver_id_card: driverId.trim(),
        p_driver_phone: driverPhone.trim(),
        p_po_number: wiPoNumber.trim(),
        p_box_count: wiBoxes.trim()
      }))

      if (error) throw error
      
      setMessage('Llegada Registrada como Novedad (Sin Cita Programada)')
      setStep('SUCCESS')
    } catch (e: unknown) {
      console.error("Walk-in Error:", e)
      const error = e as { message?: string };
      alert(error.message || 'Error al procesar el ingreso express.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. ESTADO BUSQUEDA */}
      {step === 'SEARCH' && (
        <form onSubmit={handleSearch} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-surface-container/50 space-y-8">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
              <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
            </div>
            <h2 className="text-3xl font-black font-headline tracking-tight text-on-surface">Registro de Llegada</h2>
            <p className="text-on-surface-variant/80 font-medium">Ingrese su placa o número de orden para validar su cita.</p>
          </div>

          <div className="space-y-6">
            <Input 
              label="Placa o No. Orden de Compra" 
              placeholder="EJ: ABC-123 o 4500123"
              className="text-center uppercase text-xl font-black tracking-widest h-16 rounded-2xl border-2 focus:border-primary shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              disabled={loading}
              required
            />
            <Button 
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 rounded-2xl transition-all active:scale-95" 
              disabled={loading} 
              type="submit"
            >
              {loading ? 'Buscando Cita...' : 'Buscar Programación'}
            </Button>
          </div>
        </form>
      )}

      {/* 2. ESTADO SELECCIÓN (MÚLTIPLES CITAS) */}
      {step === 'FOUND' && !selectedAppt && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-surface-container/50 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-black font-headline">Coincidencias Encontradas</h2>
            <p className="text-sm text-on-surface-variant/80 font-medium">Encontramos {appointments.length} citas. Seleccione la suya:</p>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {appointments.map(a => (
              <button 
                key={a.id} 
                onClick={() => handleSelectAppt(a)}
                className="w-full p-6 border-2 border-surface-container rounded-3xl text-left hover:border-primary hover:bg-primary/5 focus:ring-4 focus:ring-primary/10 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-black text-primary text-lg leading-tight uppercase">{capitalize(a.company_name)}</div>
                  <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                    {a.scheduled_time?.substring(0,5)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-on-surface-variant/70">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    {a.license_plate}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                    {a.box_count} cajas
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Button variant="ghost" className="w-full h-12 underline text-on-surface-variant font-bold" onClick={() => setStep('SEARCH')}>Volver a buscar</Button>
        </div>
      )}

      {/* 3. ESTADO CONFIRMACIÓN (CITA ENCONTRADA) */}
      {step === 'FOUND' && selectedAppt && (
        <form onSubmit={handleConfirmArrival} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-surface-container/50 space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-surface-container">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase tracking-widest border border-green-100">Cita Confirmada</span>
              <h2 className="text-2xl font-black font-headline text-on-surface truncate max-w-[280px]">{capitalize(selectedAppt.company_name)}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Programada</p>
              <p className="text-xl font-black text-primary">{selectedAppt.scheduled_time?.substring(0,5)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black text-center text-on-surface-variant uppercase tracking-[0.2em] opacity-60">Datos del ingreso</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Placa del Vehículo (Obligatorio)" className="uppercase font-black text-lg h-14" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} required />
              </div>
              <Input label="Cédula Conductor (Opcional)" type="number" className="font-bold" value={driverId} onChange={e => setDriverId(e.target.value)} />
              <Input label="Celular (Obligatorio)" type="number" className="font-bold" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} required />
              <div className="col-span-2">
                <Input label="Nombre del Conductor (Obligatorio)" className="font-bold h-14 capitalize" value={driverName} onChange={e => setDriverName(e.target.value)} required />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="secondary" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => { setSelectedAppt(null); setStep(appointments.length > 1 ? 'FOUND' : 'SEARCH') }}>Cancelar</Button>
            <Button className="flex-[2] h-14 bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 rounded-2xl font-black text-lg" disabled={loading} type="submit">
              {loading ? 'Procesando...' : 'Confirmar Llegada'}
            </Button>
          </div>
        </form>
      )}

      {/* 4. ESTADO NOVEDAD (SIN CITA) */}
      {step === 'NOT_FOUND' && (
         <form onSubmit={handleRegisterWalkIn} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-surface-container/50 space-y-6">
           <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">schedule</span>
            </div>
            <h2 className="text-2xl font-black font-headline text-red-900 tracking-tight">LLEGADA SIN CITA</h2>
            <p className="text-sm text-on-surface-variant/80 font-medium">No hay una cita para hoy con esa información.<br/>Puede solicitar un ingreso manual aquí:</p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-red-50/30 p-6 rounded-[2rem] border border-red-100">
            <div className="col-span-2">
              <Input label="Empresa de Transporte / Origen (Obligatorio)" required value={wiCompany} onChange={e => setWiCompany(e.target.value)} className="bg-white" />
            </div>
            <Input label="Placa (Obligatorio)" required className="uppercase font-black bg-white" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} />
            <Input label="Cédula (Opcional)" type="number" className="bg-white" value={driverId} onChange={e => setDriverId(e.target.value)} />
            <div className="col-span-2">
              <Input label="Nombre del Conductor (Obligatorio)" required className="capitalize bg-white" value={driverName} onChange={e => setDriverName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Input label="Celular (Obligatorio)" required type="number" className="bg-white" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} />
            </div>
            <Input label="No. OC (Obligatorio)" required value={wiPoNumber} onChange={e => setWiPoNumber(e.target.value)} className="bg-white" />
            <Input label="Cajas (Aprox.) (Obligatorio)" type="number" required value={wiBoxes} onChange={e => setWiBoxes(e.target.value)} className="bg-white" />
          </div>

          <div className="flex gap-4 pt-2">
            <Button variant="ghost" className="flex-1 font-bold text-on-surface-variant" onClick={() => setStep('SEARCH')}>Intentar buscar otra placa</Button>
            <Button className="flex-[2] h-14 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20 rounded-2xl font-black" disabled={loading} type="submit">
              {loading ? 'Enviando Datos...' : 'Solicitar Ingreso'}
            </Button>
          </div>
         </form>
      )}

      {/* 5. ÉXITO (CONFIRMADO) */}
      {step === 'SUCCESS' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center space-y-8 animate-in zoom-in duration-500">
          <div className="relative">
            <div className="w-28 h-28 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
              <span className="material-symbols-outlined text-6xl">check_circle</span>
            </div>
            <div className="absolute top-0 right-1/2 translate-x-14 w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-green-500 text-xl font-black">done_all</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-4xl font-black font-headline text-green-800 tracking-tighter">¡Registrado!</h2>
            <p className="text-on-surface-variant font-bold text-lg">{message}</p>
          </div>

          <div className="p-8 bg-surface-container rounded-[2.5rem] border-2 border-dashed border-outline-variant/50 space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Ticket Digital</span>
              <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-1 rounded-md">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-4 pt-2">
              <div>
                <p className="text-[9px] font-black text-on-surface-variant/60 uppercase">Vehículo</p>
                <p className="text-xl font-black text-on-surface">{licensePlate.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-on-surface-variant/60 uppercase">Conductor</p>
                <p className="font-bold text-on-surface leading-tight truncate">{capitalize(driverName.split(' ')[0])}</p>
              </div>
            </div>
            <p className="text-xs font-bold text-on-surface-variant mt-4 text-center bg-white/50 p-3 rounded-2xl italic leading-relaxed">
              &quot;Diríjase al patio de maniobras. Espere indicaciones del equipo de ISIMO para proceder con su respectivo ingreso al CEDI.&quot;
            </p>
          </div>

          <Button className="w-full h-14 rounded-2xl text-lg font-bold" onClick={() => {
            setSearchTerm('');
            setStep('SEARCH');
            setSelectedAppt(null);
            setAppointments([]);
          }}>
            Finalizar / Nuevo Registro
          </Button>
        </div>
      )}

      {/* 6. ERROR */}
      {step === 'ERROR' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center space-y-6">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-inner">
            <span className="material-symbols-outlined text-5xl">warning</span>
          </div>
          <h2 className="text-2xl font-black font-headline text-red-900">Uups, Algo salió mal</h2>
          <p className="text-on-surface-variant font-medium leading-relaxed">{message}</p>
          <div className="pt-4">
            <Button className="w-full h-14 bg-on-surface text-surface rounded-2xl font-bold" onClick={() => setStep('SEARCH')}>Intentar de nuevo</Button>
            <p className="text-[10px] font-black text-on-surface-variant/40 mt-6 uppercase tracking-widest">Si el problema persiste, contacte al supervisor.</p>
          </div>
        </div>
      )}

    </div>
  )
}
