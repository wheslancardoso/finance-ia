
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
  const nonCreditCardAccIds = accounts.filter(a => a.type !== 'CREDIT_CARD').map(a => a.id);
  
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString();
  
  const { data: monthTxs } = await supabase
    .from("transactions")
    .select("*")
    .in("account_id", accountIds)
    .gte("date", monthStart)
    .lte("date", monthEnd);
    
  const extraInc = monthTxs
    .filter(tx => tx.transaction_type === "INCOME")
    .reduce((sum, tx) => sum + tx.amount_cents, 0);
    
  const monthExp = monthTxs
    .filter(tx => tx.transaction_type === "EXPENSE" && nonCreditCardAccIds.includes(tx.account_id) && !tx.is_legacy_debt)
    .reduce((sum, tx) => sum + tx.amount_cents, 0);

  console.log(`Extra Income (Monthly): ${extraInc / 100}`);
  console.log(`Month Expenses (non-CC): ${monthExp / 100}`);
  
  // Credit Card Impact
  // For each card, find the closed invoice impact
  let totalCCImpact = 0;
  for (const acc of accounts.filter(a => a.type === 'CREDIT_CARD')) {
    const cardClosingDay = acc.closing_day || 31;
    const todayDay = now.getDate();
    let closedY = now.getFullYear();
    let closedM = now.getMonth();
    
    if (todayDay < cardClosingDay) {
      closedM--;
      if (closedM < 0) { closedM = 11; closedY--; }
    }
    
    const closedInvoiceStr = `${closedY}-${String(closedM + 1).padStart(2, '0')}-01`;
    
    const { data: txs } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", acc.id);
      
    let ceilingImpact = 0;
    txs?.forEach((tx) => {
      const txDate = new Date(tx.date);
      let tY = txDate.getUTCFullYear();
      let tM = txDate.getUTCMonth();
      if (txDate.getUTCDate() >= cardClosingDay) {
        tM++;
        if (tM > 11) { tM = 0; tY++; }
      }
      const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}-01`;
      
      if (txInvoiceStr === closedInvoiceStr && !tx.is_paid && !tx.is_legacy_debt && tx.transaction_type === 'EXPENSE') {
        ceilingImpact += tx.amount_cents;
      }
    });
    console.log(`Card ${acc.name} Impact: ${ceilingImpact / 100}`);
    totalCCImpact += ceilingImpact;
  }
  
  console.log(`Total CC Impact: ${totalCCImpact / 100}`);
  
  const survivalCeiling = 0 + 0 + extraInc - 0 - totalCCImpact - monthExp;
  console.log(`Survival Ceiling: ${survivalCeiling / 100}`);
}

check();
