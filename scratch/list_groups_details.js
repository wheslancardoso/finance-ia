
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
  const { data: groups } = await supabase.from('family_groups').select('*');
  console.log('--- FAMILY GROUPS ---');
  groups.forEach(g => {
    console.log(`ID: ${g.id}, Income: ${g.monthly_income_cents}, Expenses: ${g.fixed_expenses_cents}`);
  });
}

check();
