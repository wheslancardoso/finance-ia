const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const txRes = await fetch(`${url}/rest/v1/transactions?select=*&date=gte.2026-06-01T00:00:00&date=lt.2026-07-01T00:00:00`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const txs = await txRes.json();
  const incomes = txs.filter(r => r.transaction_type === 'INCOME');
  const expenses = txs.filter(r => r.transaction_type === 'EXPENSE');
  
  console.log("=== INCOMES ===");
  incomes.forEach(t => console.log(`${t.date.slice(0,10)} - ${t.description}: ${t.amount_cents / 100} (is_paid: ${t.is_paid}, is_adjustment: ${t.is_adjustment})`));
  console.log("=== EXPENSES ===");
  expenses.forEach(t => console.log(`${t.date.slice(0,10)} - ${t.description}: ${t.amount_cents / 100} (is_paid: ${t.is_paid}, is_adjustment: ${t.is_adjustment})`));
}
run();
