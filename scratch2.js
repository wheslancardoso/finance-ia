const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: accounts } = await supabase.from('accounts').select('*');
  console.log('Accounts:', accounts);
  
  const { data: transactions } = await supabase.from('transactions').select('*').eq('transaction_type', 'EXPENSE');
  console.log('Sample Credit Card Transactions:', transactions.filter(t => {
    const acc = accounts.find(a => a.id === t.account_id);
    return acc && acc.type === 'credit_card';
  }).slice(0, 5));
}
run();
