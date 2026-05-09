const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Let's get the family_group_id of user "lan" (which is me)
  const { data: { users }, error: authErr } = await supabase.auth.admin?.listUsers() || {};
  
  // Or just query the first few accounts to find family_group_id
  const { data: accounts } = await supabase.from('accounts').select('*');
  const accountIds = accounts.map(a => a.id);
  
  const { data: futureTransactions, error } = await supabase
    .from("transactions")
    .select("description, amount_cents, transaction_type, date, account_id, is_paid")
    .in("account_id", accountIds)
    .gt("date", new Date().toISOString())
    .or("is_paid.eq.false,is_paid.is.null")
    .order("date", { ascending: true });
    
  console.log("Future transactions count:", futureTransactions?.length);
  console.log("Sample future transactions:", futureTransactions?.slice(0, 5));
  
  // What if we don't filter by is_paid?
  const { data: allFuture } = await supabase
    .from("transactions")
    .select("description, amount_cents, transaction_type, date, account_id, is_paid")
    .in("account_id", accountIds)
    .gt("date", new Date().toISOString())
    .order("date", { ascending: true });
    
  console.log("ALL future transactions count:", allFuture?.length);
}
run();
