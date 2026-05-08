
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { startOfMonth, endOfMonth, addMonths, addDays } = require('date-fns');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const parts = l.split('=');
  return [parts[0].trim(), parts.slice(1).join('=').trim()];
}));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function fullDashboardAudit() {
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  const accountIds = accounts.map(a => a.id);
  const initialBalance = accounts.filter(a => a.type !== 'CREDIT_CARD').reduce((s, a) => s + (a.balance_cents || 0), 0);

  const { data: recurring } = await supabase.from('recurring_transactions').select('*').eq('family_group_id', FAMILY_GROUP_ID).eq('status', 'active');
  const { data: futureTransactions } = await supabase.from('transactions').select('*').in('account_id', accountIds).gt('date', new Date().toISOString()).eq('is_paid', false);

  const now = new Date();
  const endOfCurrentMonth = endOfMonth(now);

  // --- RECORRENTES até fim do mês ---
  let recurringThisMonth = 0;
  recurring.filter(item => item.frequency !== "once").forEach(item => {
    // IGNORAR se o item recorrente estiver vinculado a um cartão de crédito
    // (Pois ele já entrará no saldo da fatura aberta/fechada do cartão)
    const isCC = accounts.find(a => a.id === item.account_id)?.type === "CREDIT_CARD";
    if (isCC) return;

    let occDate = new Date(item.next_date);
    while (occDate <= endOfCurrentMonth) {
      if (occDate > now) {
        if (item.transaction_type === "EXPENSE") recurringThisMonth += item.amount_cents;
        else if (item.transaction_type === "INCOME") recurringThisMonth -= item.amount_cents;
      }
      if (item.frequency === "monthly") occDate = addMonths(occDate, 1);
      else if (item.frequency === "weekly") occDate = addDays(occDate, 7);
      else if (item.frequency === "daily") occDate = addDays(occDate, 1);
      else break;
    }
  });

  // --- PARCELAS FUTURAS DESTE MÊS ---
  const futureThisMonth = (futureTransactions || [])
    .filter(ft => {
      const d = new Date(ft.date);
      const isCC = accounts.find(a => a.id === ft.account_id)?.type === "CREDIT_CARD";
      return d > now && d <= endOfCurrentMonth && !isCC;
    })
    .reduce((sum, ft) => {
      if (ft.transaction_type === "EXPENSE") return sum + ft.amount_cents;
      if (ft.transaction_type === "INCOME") return sum - ft.amount_cents;
      return sum;
    }, 0);

  // --- CREDIT CARD DEBT ---
  let totalCreditCardDebt = 0;
  for (const acc of accounts) {
    if (acc.type !== 'CREDIT_CARD') continue;
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
      let tY = txDate.getUTCFullYear();
      let tM = txDate.getUTCMonth();
      if (txDate.getUTCDate() >= cardClosingDay) { tM++; if (tM > 11) { tM = 0; tY++; } }
      const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}-01`;
      const amountSigned = tx.transaction_type === 'INCOME' ? -tx.amount_cents : tx.amount_cents;
      if (txInvoiceStr === openInvoiceStr && !tx.is_paid) openInvoice += amountSigned;
      if (txInvoiceStr === closedInvoiceStr && !tx.is_paid) closedInvoice += amountSigned;
    });
    totalCreditCardDebt += Math.max(0, closedInvoice) + Math.max(0, openInvoice);
  }

  const plannedExpenses = futureThisMonth + recurringThisMonth + totalCreditCardDebt;
  const sobraLivre = initialBalance - plannedExpenses;

  console.log(`Initial Balance: ${initialBalance / 100}`);
  console.log(`Total CC Debt (Open+Closed): ${totalCreditCardDebt / 100}`);
  console.log(`Future this month: ${futureThisMonth / 100}`);
  console.log(`Recurring this month: ${recurringThisMonth / 100}`);
  console.log(`Planned Expenses: ${plannedExpenses / 100}`);
  console.log(`Sobra Livre: ${sobraLivre / 100}`);
}

fullDashboardAudit();
