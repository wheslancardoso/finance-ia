
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts[1].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const groupId = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';
  const { data: recurring } = await supabase.from('recurring_transactions').select('*').eq('family_group_id', groupId);
  console.log('--- RECURRING TRANSACTIONS ---');
  console.log(recurring);
  
  const { data: futureTxs } = await supabase.from('transactions').select('*').gt('date', new Date().toISOString());
  console.log('\n--- FUTURE TRANSACTIONS ---');
  console.log(futureTxs);
}

check();
