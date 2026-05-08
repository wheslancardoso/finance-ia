
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
  const { data: txs, error: txError } = await supabase.from('transactions').select('account_id').limit(100);
  if (txError) return console.error(txError);
  
  const accIds = [...new Set(txs.map(t => t.account_id))];
  console.log('Account IDs in transactions:', accIds);
  
  const { data: accs, error: accError } = await supabase.from('accounts').select('*').in('id', accIds);
  if (accError) console.error(accError);
  else console.log('Accounts fetched by ID:', accs);
}
check();
