
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

async function find() {
  const { data, error } = await supabase.from('accounts').select('family_group_id, name').or('name.ilike.%nubank%,name.ilike.%inter%,name.ilike.%picpay%');
  if (error) console.error(error);
  else {
    const groups = [...new Set(data.map(d => d.family_group_id))];
    console.log('Groups with common bank names:', groups);
    for (const gid of groups) {
        const { count } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('family_group_id', gid);
        console.log(`Group ${gid} has ${count} accounts.`);
    }
  }
}
find();
