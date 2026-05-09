import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, description, amount_cents, is_paid')
    .gt('date', '2026-05-08')
    .order('date', { ascending: true })
    .limit(10);
  console.log(data, error);
}
run();
