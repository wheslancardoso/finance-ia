
const { createClient } = require('@supabase/supabase-js');
// require('dotenv').config({ path: '.env.local' });

// Manually load env vars since dotenv might not be working or installed
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) env[parts[0].trim()] = parts[1].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: accounts, error } = await supabase.from('accounts').select('*');
  if (error) {
    console.error(error);
    return;
  }

  console.log('--- ACCOUNTS ---');
  let sumNonCC = 0;
  accounts.forEach(a => {
    console.log(`${a.name} (${a.type}): ${a.balance_cents / 100}`);
    if (a.type !== 'CREDIT_CARD') {
      sumNonCC += a.balance_cents;
    }
  });

  console.log('\n--- CALCULATIONS ---');
  console.log(`Sum of non-CC accounts (Initial Balance): ${sumNonCC / 100}`);
  
  // Get budgets
  const { data: budgets } = await supabase.from('budgets').select('*');
  const { data: transactions } = await supabase.from('transactions').select('*');
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const spentThisMonth = transactions
    .filter(t => t.transaction_type === 'EXPENSE' && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd)
    .reduce((acc, t) => acc + t.amount_cents, 0);

  const totalBudget = budgets.reduce((acc, b) => acc + b.amount_cents, 0);
  
  // This is a simplification. Real code matches by category.
  console.log(`Total Budgets: ${totalBudget / 100}`);
  
  // Let's get the specific categories
  const { data: categories } = await supabase.from('categories').select('*');
  
  let totalRemainingBudget = 0;
  budgets.forEach(b => {
    const catSpent = transactions
      .filter(t => t.category_id === b.category_id && t.transaction_type === 'EXPENSE' && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd)
      .reduce((acc, t) => acc + t.amount_cents, 0);
    const remaining = Math.max(0, b.amount_cents - catSpent);
    totalRemainingBudget += remaining;
  });

  console.log(`Total Remaining Budget: ${totalRemainingBudget / 100}`);
  console.log(`Dashboard main value (InitialBalance - RemainingBudget): ${(sumNonCC - totalRemainingBudget) / 100}`);
}

check();
