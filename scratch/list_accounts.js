
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const parts = l.split('=');
  return [parts[0].trim(), parts.slice(1).join('=').trim()];
}));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function listAccounts() {
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  console.log('--- Individual Accounts ---');
  let checkingSum = 0;
  accounts.forEach(a => {
    const balance = (a.balance_cents || 0) / 100;
    console.log(`${a.name} (${a.type}): R$ ${balance.toFixed(2)}`);
    if (a.type !== 'CREDIT_CARD') {
        checkingSum += balance;
    }
  });
  console.log('--- Summary ---');
  console.log(`Total Checking/Savings: R$ ${checkingSum.toFixed(2)}`);
}

listAccounts();
