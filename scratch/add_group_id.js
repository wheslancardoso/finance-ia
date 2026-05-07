
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addColumn() {
  console.log('Tentando adicionar coluna installment_group_id...');
  
  // Como não temos acesso direto ao SQL via SDK de forma fácil (sem RPC)
  // Vamos tentar verificar se conseguimos rodar via uma query bruta se o RPC existir
  // Mas no Supabase comum, o ideal é o usuário rodar no Dashboard.
  
  console.log('AVISO: Por favor, execute este comando no Dashboard do Supabase (SQL Editor):');
  console.log('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_group_id UUID;');
  console.log('CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(installment_group_id);');
}

addColumn();
