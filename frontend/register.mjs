
import { createClient } from './node_modules/@supabase/supabase-js/dist/main/index.js'

const supabaseUrl = 'https://wrtuzkqnhkaajohalygi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydHV6a3FuaGthYWpvaGFseWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTM5NjksImV4cCI6MjA5MTE4OTk2OX0.IGFRSXgZSMdzcgzjDwf830j6_2QpGJOzwwKuyBxc_Cg'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function registerAdmin() {
  const email = 'admin@isimo.com.co'
  const password = 'admin123'
  
  console.log('Registering...')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Super Admin'
      }
    }
  })

  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Success:', data.user.id)
  }
}

registerAdmin()
