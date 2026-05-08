
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { count, error } = await supabase.from('accounts').select('*', { count: 'exact', head: true });
  if (error) console.error(error);
  else console.log('Total accounts:', count);

  const { count: txCount, error: txError } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  if (txError) console.error(txError);
  else console.log('Total transactions:', txCount);
}
check();
