/**
 * 🩺 VESPER DIAGNOSE TOOL
 * Ferramenta avançada para auditoria de integridade e lógica financeira.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { endOfMonth, format } = require('date-fns');

// Carregar ENV
const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
envLines.forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FAMILY_GROUP_ID = 'b86b716a-afb3-46ed-9098-7f5aa9c68bc5';

async function diagnose() {
  console.log('🩺 Iniciando Diagnóstico Vesper...\n');

  // 1. Verificar Contas
  const { data: accounts } = await supabase.from('accounts').select('*').eq('family_group_id', FAMILY_GROUP_ID);
  console.log(`📊 Contas Encontradas: ${accounts.length}`);
  
  const ccAccounts = accounts.filter(a => a.type === 'CREDIT_CARD');
  const bankAccounts = accounts.filter(a => a.type !== 'CREDIT_CARD');
  
  console.log(`   - Contas Bancárias: ${bankAccounts.length}`);
  console.log(`   - Cartões de Crédito: ${ccAccounts.length}`);

  // 2. Procurar Transações "Fantasmas" (Valor alto e não pagas)
  const { data: ghosts } = await supabase
    .from('transactions')
    .select('*')
    .in('account_id', accounts.map(a => a.id))
    .eq('is_paid', false)
    .gt('amount_cents', 100000); // Mais de R$ 1.000,00

  if (ghosts && ghosts.length > 0) {
    console.log('\n⚠️  ALERTA: Transações não pagas de valor alto (> R$ 1.000):');
    ghosts.forEach(g => {
      console.log(`   - [${g.date}] ${g.description}: R$ ${g.amount_cents / 100}`);
    });
  }

  // 3. Verificar Duplicidade em Recorrentes
  const { data: recurring } = await supabase.from('recurring_transactions').select('*').eq('family_group_id', FAMILY_GROUP_ID).eq('status', 'active');
  const ccRecurring = recurring.filter(r => ccAccounts.find(acc => acc.id === r.account_id));
  
  if (ccRecurring.length > 0) {
    console.log('\nℹ️  INFO: Itens recorrentes em Cartão de Crédito:');
    ccRecurring.forEach(r => {
      console.log(`   - ${r.description}: R$ ${r.amount_cents / 100} (Corretamente ignorado no cálculo de "Agendados" para evitar bitributação)`);
    });
  }

  // 4. Auditoria de Faturas
  console.log('\n💳 Auditoria de Faturas de Cartão:');
  for (const cc of ccAccounts) {
    const { data: txs } = await supabase.from('transactions').select('*').eq('account_id', cc.id).eq('is_paid', false);
    const total = txs.reduce((s, t) => s + (t.transaction_type === 'INCOME' ? -t.amount_cents : t.amount_cents), 0);
    console.log(`   - ${cc.name}: R$ ${total / 100} em aberto (${txs.length} transações)`);
  }

  // 5. Integridade do Teto (Survival Math)
  const { data: group } = await supabase.from('family_groups').select('*').eq('id', FAMILY_GROUP_ID).single();
  console.log('\n🛡️  Configurações Modo Crise:');
  console.log(`   - Renda Base: R$ ${group.monthly_income_cents / 100}`);
  console.log(`   - Custo Fixo: R$ ${group.fixed_expenses_cents / 100}`);
  console.log(`   - Sobras Acumuladas: R$ ${group.accumulated_balance_cents / 100}`);

  console.log('\n✅ Diagnóstico concluído.');
}

diagnose();
