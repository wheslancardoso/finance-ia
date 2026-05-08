
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
  const { data: accounts } = await supabase.from('accounts').select('*');
  console.log('--- ALL ACCOUNTS ---');
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Name: ${a.name}, Balance: ${a.balance_cents}, Group: ${a.family_group_id}, Type: ${a.type}`);
  });
}

check();
