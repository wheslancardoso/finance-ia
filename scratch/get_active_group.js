
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
  const { data: accounts } = await supabase.from('accounts').select('family_group_id').limit(1);
  if (accounts && accounts.length > 0) {
    const groupId = accounts[0].family_group_id;
    console.log(`Active Group ID: ${groupId}`);
    
    const { data: group } = await supabase.from('family_groups').select('*').eq('id', groupId).single();
    console.log('Group Details:', group);
    
    const { data: allAccs } = await supabase.from('accounts').select('*').eq('family_group_id', groupId);
    console.log('\n--- ACCOUNTS FOR THIS GROUP ---');
    allAccs.forEach(a => console.log(`${a.name}: ${a.balance_cents / 100}`));
  }
}

check();
