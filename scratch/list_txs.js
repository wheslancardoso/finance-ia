
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { startOfMonth, endOfMonth } = require('date-fns');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const parts = l.split('=');
  return [parts[0].trim(), parts.slice(1).join('=').trim()];
}));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function listCurrentTransactions() {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: accounts } = await supabase.from('accounts').select('id, name');
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

  const { data: txs } = await supabase.from('transactions')
    .select('*')
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: true });

  console.log('--- TRANSACTIONS THIS MONTH ---');
  let total = 0;
  txs.forEach(t => {
    const date = t.date.split('T')[0];
    const amount = t.amount_cents / 100;
    const type = t.transaction_type === 'INCOME' ? 'INC' : 'EXP';
    console.log(`${date} | ${type} | ${t.description.padEnd(30)} | ${amount.toFixed(2).padStart(10)} | ${accMap[t.account_id]}`);
    if (t.transaction_type === 'EXPENSE') total += t.amount_cents;
    else total -= t.amount_cents;
  });
  console.log('-'.repeat(80));
  console.log(`NET FLOW: R$ ${(total / 100).toFixed(2)}`);
  
  const expenseTotal = txs.filter(t => t.transaction_type === 'EXPENSE').reduce((s, t) => s + t.amount_cents, 0);
  console.log(`TOTAL EXPENSES: R$ ${(expenseTotal / 100).toFixed(2)}`);
}

listCurrentTransactions();
