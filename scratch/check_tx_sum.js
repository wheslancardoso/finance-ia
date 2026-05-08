
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
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', groupId);
  const accountIds = accounts.map(a => a.id);
  
  const { data: txs } = await supabase.from('transactions').select('*').in('account_id', accountIds);
  
  let income = 0;
  let expense = 0;
  txs.forEach(t => {
    if (t.transaction_type === 'INCOME') income += t.amount_cents;
    else expense += t.amount_cents;
  });
  
  console.log(`Total Income: ${income / 100}`);
  console.log(`Total Expense: ${expense / 100}`);
  console.log(`Balance (I-E): ${(income - expense) / 100}`);
  
  // Now let's check for "R$2286,12"
  // Is it income - expenses for this month?
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthTxs = txs.filter(t => new Date(t.date) >= monthStart);
  
  let mIncome = 0;
  let mExpense = 0;
  thisMonthTxs.forEach(t => {
    if (t.transaction_type === 'INCOME') mIncome += t.amount_cents;
    else mExpense += t.amount_cents;
  });
  console.log(`This Month Balance: ${(mIncome - mExpense) / 100}`);
}

check();
