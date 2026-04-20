import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wrtuzkqnhkaajohalygi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydHV6a3FuaGthYWpvaGFseWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTM5NjksImV4cCI6MjA5MTE4OTk2OX0.IGFRSXgZSMdzcgzjDwf830j6_2QpGJOzwwKuyBxc_Cg'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('--- Verificando columna is_express en tabla appointments ---')
  
  const { data, error } = await supabase
    .from('appointments')
    .select('id, license_plate, is_walk_in, is_express')
    .limit(5)

  if (error) {
    console.error('❌ Error al consultar la columna:', error.message)
    if (error.message.includes('column "is_express" does not exist')) {
      console.log('⚠️ LA COLUMNA NO EXISTE AÚN EN LA BASE DE DATOS.')
    }
  } else {
    console.log('✅ CONEXIÓN EXITOSA. La columna is_express está presente.')
    console.log('Muestra de datos:', JSON.stringify(data, null, 2))
  }
}

testConnection()
