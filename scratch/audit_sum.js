
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local because dotenv might not be available or working as expected
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for full access
const supabase = createClient(supabaseUrl, supabaseKey);

const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function auditSum() {
  console.log(`Auditing balances for Family Group: ${FAMILY_GROUP_ID}\n`);

  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('*')
    .eq('family_group_id', FAMILY_GROUP_ID);

  if (accError) {
    console.error('Error fetching accounts:', accError);
    return;
  }

  console.log('--- DEBIT ACCOUNTS ---');
  let sumDebit = 0;
  accounts.filter(a => a.type !== 'CREDIT_CARD').forEach(acc => {
    const balance = acc.balance_cents / 100;
    console.log(`${acc.name.padEnd(20)}: R$ ${balance.toFixed(2).padStart(10)}`);
    sumDebit += acc.balance_cents;
  });
  console.log('-'.repeat(40));
  console.log(`SUM OF DEBIT ACCOUNTS   : R$ ${(sumDebit / 100).toFixed(2).padStart(10)}`);
  
  console.log('\n--- CREDIT CARDS ---');
  let sumCreditOpen = 0;
  let sumCreditClosed = 0;
  accounts.filter(a => a.type === 'CREDIT_CARD').forEach(acc => {
    const open = acc.open_invoice_cents / 100;
    const closed = acc.closed_invoice_cents / 100;
    console.log(`${acc.name.padEnd(20)}: Open: R$ ${open.toFixed(2).padStart(8)} | Closed: R$ ${closed.toFixed(2).padStart(8)}`);
    sumCreditOpen += acc.open_invoice_cents;
    sumCreditClosed += acc.closed_invoice_cents;
  });
  console.log('-'.repeat(40));
  console.log(`SUM OF OPEN INVOICES    : R$ ${(sumCreditOpen / 100).toFixed(2).padStart(10)}`);
  console.log(`SUM OF CLOSED INVOICES  : R$ ${(sumCreditClosed / 100).toFixed(2).padStart(10)}`);

  const dashboardValue = 2286.12;
  const diff = (sumDebit / 100) - dashboardValue;
  
  console.log(`\nDashboard is showing     : R$ ${dashboardValue.toFixed(2).padStart(10)}`);
  if (Math.abs(diff) < 0.01) {
    console.log('✅ Matches exactly the sum of debit accounts!');
  } else {
    console.log(`❌ Discrepancy: R$ ${diff.toFixed(2)}`);
  }
}

auditSum();
