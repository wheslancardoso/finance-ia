const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const resA = await fetch(`${url}/rest/v1/accounts?select=id,name,type,balance_cents,open_invoice_cents,closed_invoice_cents`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log("ACCOUNTS:", await resA.json());

  const resT = await fetch(`${url}/rest/v1/transactions?select=id,description,amount_cents,transaction_type,is_adjustment,date&order=date.desc&limit=10&is_adjustment=eq.true`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log("ADJUSTMENTS:", await resT.json());
}
run();
