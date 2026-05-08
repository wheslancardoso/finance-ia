
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { startOfMonth, endOfMonth } = require('date-fns');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const parts = l.split('=');
  return [parts[0].trim(), parts.slice(1).join('=').trim()];
}));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function deepAudit() {
  console.log(`Deep Audit for Family Group: ${FAMILY_GROUP_ID}\n`);

  // 1. Accounts
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  const accountIds = accounts.map(a => a.id);
  const checkingAccounts = accounts.filter(a => a.type !== 'CREDIT_CARD');
  const initialBalance = checkingAccounts.reduce((sum, a) => sum + (a.balance_cents || 0), 0);
  
  console.log('--- ACCOUNTS ---');
  accounts.forEach(a => console.log(`${a.name} (${a.type}): ${a.balance_cents / 100}`));
  console.log(`Initial Balance (Sum of non-CC): ${initialBalance / 100}\n`);

  // 2. Transactions current month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in('account_id', accountIds)
    .gte('date', monthStart.toISOString())
    .lte('date', monthEnd.toISOString());

  console.log('--- TRANSACTIONS THIS MONTH ---');
  let income = 0;
  let expenseNonCC = 0;
  let expenseCC = 0;
  
  transactions.forEach(t => {
    const isCC = accounts.find(a => a.id === t.account_id).type === 'CREDIT_CARD';
    if (t.transaction_type === 'INCOME') {
      income += t.amount_cents;
    } else {
      if (isCC) expenseCC += t.amount_cents;
      else expenseNonCC += t.amount_cents;
    }
  });

  console.log(`Income: ${income / 100}`);
  console.log(`Expense (Debit/Checking): ${expenseNonCC / 100}`);
  console.log(`Expense (Credit Card): ${expenseCC / 100}\n`);

  // 3. Budgets
  const { data: budgets } = await supabase.from('budgets').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount_cents, 0);
  console.log(`Total Monthly Budget: ${totalBudget / 100}\n`);

  // 4. Survival Ceiling Calculation
  const { data: fg } = await supabase.from('family_groups').select('*').eq('id', FAMILY_GROUP_ID).single();
  const monthlyIncome = fg.monthly_income_cents || 0;
  const fixedExpenses = fg.fixed_expenses_cents || 0;
  const accumulatedBalance = fg.accumulated_balance_cents || 0;
  
  // totalCreditCardImpact (from FinancialDataContext logic - closed invoice impact)
  // This is hard to calculate exactly without knowing the closing dates precisely here, 
  // but let's assume it's related to the CC transactions.
  
  console.log('--- SURVIVAL HUD MATH ---');
  console.log(`Monthly Income (Base): ${monthlyIncome / 100}`);
  console.log(`Accumulated (Saved): ${accumulatedBalance / 100}`);
  console.log(`Extra Income (This month): ${income / 100}`);
  console.log(`Fixed Expenses: ${fixedExpenses / 100}`);
  console.log(`Variable Expenses (Non-CC): ${expenseNonCC / 100}`);
  
  const ceiling = (monthlyIncome + accumulatedBalance + income) - (fixedExpenses + expenseNonCC);
  console.log(`Estimated Ceiling (pre-CC impact): ${ceiling / 100}\n`);

  // 5. Total CC Debt
  const totalCCDebt = accounts.filter(a => a.type === 'CREDIT_CARD').reduce((sum, a) => sum + Math.abs(a.balance_cents || 0), 0);
  console.log(`Total Credit Card Debt: ${totalCCDebt / 100}`);
  
  // 6. Sobra Livre (RealtimeDashboard logic)
  const sobraLivre = initialBalance - (totalCCDebt + expenseNonCC); // simplified
  console.log(`Estimated Sobra Livre (simplified): ${sobraLivre / 100}`);
}

deepAudit();
