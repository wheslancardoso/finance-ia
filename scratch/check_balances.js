
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalances() {
  // We need a family group ID. Let's find one from the first account we find.
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('*');

  if (accError) {
    console.error('Error fetching accounts:', accError);
    return;
  }

  console.log('--- ACCOUNTS ---');
  let totalDebit = 0;
  accounts.forEach(acc => {
    console.log(`${acc.name} (${acc.type}): ${acc.balance_cents / 100} BRL`);
    if (acc.type !== 'CREDIT_CARD') {
      totalDebit += acc.balance_cents;
    }
  });
  console.log(`TOTAL DEBIT: ${totalDebit / 100} BRL`);

  // Check invoices for Credit Cards
  console.log('\n--- CREDIT CARD DETAILS ---');
  accounts.filter(a => a.type === 'CREDIT_CARD').forEach(acc => {
    console.log(`${acc.name}:`);
    console.log(`  Closed Invoice: ${acc.closed_invoice_cents / 100} BRL`);
    console.log(`  Open Invoice: ${acc.open_invoice_cents / 100} BRL`);
  });
}

checkBalances();
