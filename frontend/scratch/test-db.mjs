import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTraceability() {
  console.log("Fetching some recent appointments...");
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, status, arrival_time, docking_time, start_unloading_time, end_unloading_time, scheduled_time, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching appointments:", error);
    return;
  }

  console.table(appointments);
}

testTraceability();
