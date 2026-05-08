
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { startOfMonth, endOfMonth, format } = require('date-fns');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const parts = l.split('=');
  return [parts[0].trim(), parts.slice(1).join('=').trim()];
}));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function auditDashboardLogic() {
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  const accountIds = accounts.map(a => a.id);

  console.log('--- CREDIT CARD INVOICE AUDIT ---');
  let totalCreditCardDebt = 0;

  for (const acc of accounts) {
    if (acc.type !== 'CREDIT_CARD') continue;

    const now = new Date();
    const cardClosingDay = acc.closing_day || 31;
    const todayDay = now.getDate();

    let openY = now.getFullYear();
    let openM = now.getMonth();
    let closedY = now.getFullYear();
    let closedM = now.getMonth();

    if (todayDay >= cardClosingDay) {
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

    const { data: txs } = await supabase.from('transactions').select('*').eq('account_id', acc.id);
    
    let openInvoice = 0;
    let closedInvoice = 0;

    txs?.forEach((tx) => {
      const txDate = new Date(tx.date);
      const isIncome = tx.transaction_type === 'INCOME';
      
      let tY = txDate.getUTCFullYear();
      let tM = txDate.getUTCMonth();
      if (txDate.getUTCDate() >= cardClosingDay) {
        tM++;
        if (tM > 11) { tM = 0; tY++; }
      }
      const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}-01`;
      const amountSigned = isIncome ? -tx.amount_cents : tx.amount_cents;

      if (txInvoiceStr === openInvoiceStr && !tx.is_paid) openInvoice += amountSigned;
      if (txInvoiceStr === closedInvoiceStr && !tx.is_paid) closedInvoice += amountSigned;
    });

    const cardDebt = Math.max(0, closedInvoice) + Math.max(0, openInvoice);
    console.log(`${acc.name}: Closed: ${closedInvoice/100} | Open: ${openInvoice/100} | Total considered: ${cardDebt/100}`);
    totalCreditCardDebt += cardDebt;
  }

  console.log(`\nTOTAL CREDIT CARD DEBT: R$ ${totalCreditCardDebt / 100}`);

  // Now calculate futureThisMonth and recurringThisMonth
  const now = new Date();
  const endOfCurrentMonth = endOfMonth(now);

  const { data: recurring } = await supabase.from('recurring_transactions').select('*').eq('family_group_id', FAMILY_GROUP_ID).eq('status', 'active');
  const { data: futureTransactions } = await supabase.from('transactions').select('*').in('account_id', accountIds).gt('date', now.toISOString()).eq('is_paid', false);

  const futureThisMonth = (futureTransactions || [])
    .filter(ft => {
      const d = new Date(ft.date);
      const isCC = accounts.find(a => a.id === ft.account_id)?.type === 'CREDIT_CARD';
      return d > now && d <= endOfCurrentMonth && !isCC;
    })
    .reduce((sum, ft) => {
      if (ft.transaction_type === 'EXPENSE') return sum + ft.amount_cents;
      if (ft.transaction_type === 'INCOME') return sum - ft.amount_cents;
      return sum;
    }, 0);

  // Recurring logic (simplified for this audit)
  let recurringThisMonth = 0;
  // (Ignoring recurring for now to see if we get close to 3779.09)

  const plannedExpenses = futureThisMonth + recurringThisMonth + totalCreditCardDebt;
  console.log(`Future this month (non-CC): R$ ${futureThisMonth / 100}`);
  console.log(`Planned Expenses (Calculated): R$ ${plannedExpenses / 100}`);
}

auditDashboardLogic();
