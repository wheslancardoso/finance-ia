-- Migração para Suporte a Cartões de Crédito (Vesper Credit Cards)

-- 1. Adicionar campos específicos de cartão na tabela de contas
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS credit_limit_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_day INT CHECK (closing_day >= 1 AND closing_day <= 31),
ADD COLUMN IF NOT EXISTS due_day INT CHECK (due_day >= 1 AND due_day <= 31);

-- 2. Atualizar o tipo de conta (caso não exista o enum ou check)
-- No nosso caso, o campo 'type' é TEXT, então vamos garantir que 'CREDIT_CARD' seja uma opção válida na lógica.

-- 3. Seed de um Cartão de Exemplo
DO $$ 
DECLARE
    v_group_id UUID;
BEGIN
    SELECT id INTO v_group_id FROM family_groups LIMIT 1;
    
    IF v_group_id IS NOT NULL THEN
        INSERT INTO accounts (family_group_id, name, type, balance_cents, credit_limit_cents, closing_day, due_day, color_hex)
        VALUES 
        (v_group_id, 'Cartão Inter Black', 'CREDIT_CARD', 0, 1500000, 5, 12, '#FF7A00')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
