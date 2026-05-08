const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); 
  // Opcionalmente podemos tentar query no pg_catalog se for permitido:
  // Mas como não temos certeza de RPC, podemos tentar inferir das chamadas do app.
}
