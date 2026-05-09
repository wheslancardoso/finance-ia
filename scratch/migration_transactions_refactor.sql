-- Migração: Refatoração de Transações e Vínculo de Cartões de Crédito

-- 1. Identificador de grupo para parcelas
-- Isso permite atualizar ou deletar toda a série de parcelas sem depender apenas da descrição da transação.
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS installment_group_id UUID;

-- 2. Vínculo de Contas
-- Para Cartões de Crédito, permite indicar qual é a Conta Corrente vinculada que geralmente paga a fatura.
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- 3. Vínculo de Transação Pai
-- Permite que uma transação (como o pagamento da fatura) referencie a fatura ou outras transações associadas.
-- Obs: A tabela transactions já pode ter um linked_transaction_id, mas caso não tenha, garantimos aqui.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='linked_transaction_id') THEN
        ALTER TABLE transactions ADD COLUMN linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;
    END IF;
END $$;
