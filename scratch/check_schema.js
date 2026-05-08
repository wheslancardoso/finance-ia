
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'transactions' });
  if (error) {
    // If RPC doesn't exist, try a simple query
    const { data: sample } = await supabase.from('transactions').select('*').limit(1);
    console.log('Sample transaction columns:', Object.keys(sample[0] || {}));
  } else {
    console.log('Columns:', data);
  }
}

checkSchema();
