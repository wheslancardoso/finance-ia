
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
  const { data, error } = await supabase.from('transactions').select('*').ilike('description', '%Shopee%').limit(1);
  if (error) console.error(error);
  else if (data.length > 0) {
      console.log('Found transaction:', data[0]);
      const accId = data[0].account_id;
      const { data: acc } = await supabase.from('accounts').select('family_group_id').eq('id', accId).single();
      console.log('FAMILY GROUP ID FOUND:', acc.family_group_id);
  } else {
      console.log('No Shopee transaction found.');
  }
}
find();
