
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { format } = require('date-fns');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const parts = l.split('=');
  return [parts[0].trim(), parts.slice(1).join('=').trim()];
}));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function auditTransactions() {
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  const now = new Date();
  
  console.log('--- Account Balances (Checking/Savings) ---');
  let checkingSum = 0;
  accounts.filter(a => a.type !== 'CREDIT_CARD').forEach(a => {
    console.log(`${a.name}: R$ ${(a.balance_cents/100).toFixed(2)}`);
    checkingSum += a.balance_cents;
  });

  console.log('\n--- Credit Card Breakdown ---');
  let totalClosed = 0;
  let totalOpen = 0;
  let totalFuture = 0;

  for (const acc of accounts) {
    if (acc.type !== 'CREDIT_CARD') continue;
    
    const closingDay = acc.closing_day || 10;
    const todayDay = now.getDate();
    
    let openM = now.getMonth();
    let openY = now.getFullYear();
    let closedM = openM - 1;
    let closedY = openY;
    
    if (todayDay >= closingDay) {
      closedM = openM; closedY = openY;
      openM++; if (openM > 11) { openM = 0; openY++; }
    } else {
      if (closedM < 0) { closedM = 11; closedY--; }
    }
    
    const openInvoiceStr = `${openY}-${String(openM + 1).padStart(2, '0')}`;
    const closedInvoiceStr = `${closedY}-${String(closedM + 1).padStart(2, '0')}`;

    const { data: txs } = await supabase.from('transactions').select('*').eq('account_id', acc.id).eq('is_paid', false);
    
    let cardClosed = 0;
    let cardOpen = 0;
    let cardFuture = 0;

    txs?.forEach(tx => {
      const txDate = new Date(tx.date);
      let tM = txDate.getUTCMonth();
      let tY = txDate.getUTCFullYear();
      if (txDate.getUTCDate() >= closingDay) {
        tM++; if (tM > 11) { tM = 0; tY++; }
      }
      const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}`;
      const amount = tx.transaction_type === 'EXPENSE' ? tx.amount_cents : -tx.amount_cents;

      if (txInvoiceStr === closedInvoiceStr) {
        cardClosed += amount;
        if (acc.name.includes('Mercado Pago')) {
          console.log(`    [CLOSED TX] ${tx.date} - ${tx.description}: R$ ${(tx.amount_cents/100).toFixed(2)}`);
        }
      }
      else if (txInvoiceStr === openInvoiceStr) cardOpen += amount;
      else cardFuture += amount;
    });

    console.log(`${acc.name} (Closing Day: ${closingDay}):`);
    console.log(`  Closed Invoice (${closedInvoiceStr}): R$ ${(cardClosed/100).toFixed(2)}`);
    console.log(`  Open Invoice (${openInvoiceStr}): R$ ${(cardOpen/100).toFixed(2)}`);
    console.log(`  Future Invoices: R$ ${(cardFuture/100).toFixed(2)}`);
    
    totalClosed += cardClosed;
    totalOpen += cardOpen;
    totalFuture += cardFuture;
  }

  console.log('\n--- Final Totals ---');
  console.log(`Initial Balance (Checking): R$ ${(checkingSum/100).toFixed(2)}`);
  console.log(`Current Debt (Closed + Open): R$ ${((totalClosed + totalOpen)/100).toFixed(2)}`);
  console.log(`Sobra Livre (Balance - Debt): R$ ${((checkingSum - (totalClosed + totalOpen))/100).toFixed(2)}`);
  console.log(`Total Long-term Debt (Future): R$ ${(totalFuture/100).toFixed(2)}`);
}

auditTransactions();
