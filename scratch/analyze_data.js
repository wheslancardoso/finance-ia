
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const familyGroupId = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function analyze() {
  console.log('--- ANALYSIS FOR FAMILY GROUP:', familyGroupId, '---');

  // 1. Fetch Accounts
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('*')
    .eq('family_group_id', familyGroupId);

  if (accError) {
    console.error('Error fetching accounts:', accError);
    return;
  }

  const accountIds = accounts.map(a => a.id);
  console.log('\nACCOUNTS FOUND:', accounts.length);

  // 2. Fetch Transactions for these accounts
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .in('account_id', accountIds);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return;
  }

  console.log(`\nTOTAL TRANSACTIONS: ${transactions.length}`);

  // 3. Analyze Credit Cards
  const creditCards = accounts.filter(acc => acc.type === 'CREDIT_CARD');
  let totalCeilingImpact = 0;

  for (const acc of creditCards) {
    console.log(`\n--- CREDIT CARD: ${acc.name} ---`);
    const cardClosingDay = acc.closing_day || 31;
    const now = new Date();
    
    let openY = now.getFullYear();
    let openM = now.getMonth();
    let closedY = now.getFullYear();
    let closedM = now.getMonth();

    if (now.getDate() >= cardClosingDay) {
      closedM = openM; closedY = openY;
      openM++;
      if (openM > 11) { openM = 0; openY++; }
    } else {
      openM = closedM; openY = closedY;
      closedM--;
      if (closedM < 0) { closedM = 11; closedY--; }
    }

    const openInvoiceStr = `${openY}-${String(openM + 1).padStart(2, '0')}-01`;
    const closedInvoiceStr = `${closedY}-${String(closedM + 1).padStart(2, '0')}-01`;

    const cardTxs = transactions.filter(tx => tx.account_id === acc.id);
    let openInvoice = 0;
    let closedInvoice = 0;
    let ceilingImpact = 0;

    cardTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      const isIncome = tx.transaction_type === 'INCOME';
      const amountSigned = isIncome ? -tx.amount_cents : tx.amount_cents;

      let tY = txDate.getUTCFullYear();
      let tM = txDate.getUTCMonth();
      if (txDate.getUTCDate() >= cardClosingDay) {
        tM++;
        if (tM > 11) { tM = 0; tY++; }
      }
      const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}-01`;

      if (txInvoiceStr === openInvoiceStr && !tx.is_paid) openInvoice += amountSigned;
      if (txInvoiceStr === closedInvoiceStr && !tx.is_paid) {
        closedInvoice += amountSigned;
        if (!tx.is_legacy_debt && !isIncome) ceilingImpact += tx.amount_cents;
      }
    });

    console.log(`Open Invoice: R$ ${(openInvoice / 100).toFixed(2)}`);
    console.log(`Closed Invoice: R$ ${(closedInvoice / 100).toFixed(2)}`);
    console.log(`Ceiling Impact: R$ ${(ceilingImpact / 100).toFixed(2)}`);
    totalCeilingImpact += ceilingImpact;
  }

  // 4. Monthly Outlook
  const nonCreditCardAccIds = accounts.filter(a => a.type !== 'CREDIT_CARD').map(a => a.id);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  
  const currentMonthExpenses = transactions
    .filter(tx => 
      tx.transaction_type === 'EXPENSE' && 
      nonCreditCardAccIds.includes(tx.account_id) && 
      !tx.is_legacy_debt &&
      new Date(tx.date) >= monthStart &&
      new Date(tx.date) <= monthEnd
    )
    .reduce((sum, tx) => sum + tx.amount_cents, 0);

  const extraIncome = transactions
    .filter(tx => 
      tx.transaction_type === 'INCOME' && 
      new Date(tx.date) >= monthStart &&
      new Date(tx.date) <= monthEnd
    )
    .reduce((sum, tx) => sum + tx.amount_cents, 0);

  console.log(`\nMONTHLY OUTLOOK:`);
  console.log(`- Current Month Expenses (Non-CC, !Legacy): R$ ${(currentMonthExpenses / 100).toFixed(2)}`);
  console.log(`- Extra Income (This Month): R$ ${(extraIncome / 100).toFixed(2)}`);

  // 5. Survival HUD Calc
  const { data: fg } = await supabase.from('family_groups').select('*').eq('id', familyGroupId).single();
  console.log(`\nFAMILY GROUP CONFIG:`);
  console.log(`- Monthly Income: R$ ${(fg.monthly_income_cents / 100).toFixed(2)}`);
  console.log(`- Fixed Expenses: R$ ${(fg.fixed_expenses_cents / 100).toFixed(2)}`);
  
  const predicted = (fg.fixed_expenses_cents + totalCeilingImpact + currentMonthExpenses) / 100;
  console.log(`\nTOTAL PREDICTED EXPENSES (HUD Math): R$ ${predicted.toFixed(2)}`);
}

analyze();
