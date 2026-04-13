import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wrtuzkqnhkaajohalygi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydHV6a3FuaGthYWpvaGFseWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTM5NjksImV4cCI6MjA5MTE4OTk2OX0.IGFRSXgZSMdzcgzjDwf830j6_2QpGJOzwwKuyBxc_Cg' // Using anon key, but usually service role for seed
const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Seed started...')
  const today = new Date().toISOString().split('T')[0]

  const data = [
    {
      po_number: 'PO-882103',
      company_name: 'P&G Colombia',
      scheduled_date: today,
      scheduled_time: '08:00:00',
      box_count: 450,
      vehicle_type: 'Tractocamión',
      license_plate: 'KLU-291',
      driver_name: 'Carlos Rodríguez',
      driver_phone: '3102931022',
      status: 'PENDIENTE'
    },
    {
      po_number: 'PO-991022',
      company_name: 'Nutresa S.A.',
      scheduled_date: today,
      scheduled_time: '09:30:00',
      box_count: 220,
      vehicle_type: 'Sencillo',
      license_plate: 'MTY-552',
      driver_name: 'Javier Gómez',
      driver_phone: '3005512290',
      status: 'EN_PATIO'
    },
    {
      po_number: 'PO-112233',
      company_name: 'Alquería',
      scheduled_date: today,
      scheduled_time: '10:00:00',
      box_count: 800,
      vehicle_type: 'Turbo',
      license_plate: 'GHT-112',
      driver_name: 'Andrés López',
      driver_phone: '3201112233',
      status: 'EN_MUELLE',
      dock_id: 1
    },
    {
      po_number: 'PO-773344',
      company_name: 'Bavaria',
      scheduled_date: today,
      scheduled_time: '06:00:00',
      box_count: 1500,
      vehicle_type: 'Minimula',
      license_plate: 'FDS-009',
      driver_name: 'Mauricio Prada',
      driver_phone: '3110098877',
      status: 'DESCARGANDO',
      dock_id: 5
    }
  ]

  const { error } = await supabase.from('appointments').insert(data)
  if (error) {
    console.error('Error seeding data:', error)
  } else {
    console.log('Seed completed successfully!')
  }
}

seed()
