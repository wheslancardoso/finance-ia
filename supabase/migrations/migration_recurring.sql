-- Migração para Transações Recorrentes (Vesper Recurring)

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INCOME', 'EXPENSE')),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view recurring of their family group" ON recurring_transactions
    FOR SELECT USING (
        family_group_id IN (
            SELECT family_group_id FROM family_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage recurring of their family group" ON recurring_transactions
    FOR ALL USING (
        family_group_id IN (
            SELECT family_group_id FROM family_members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Seed de teste para recorrências
DO $$ 
DECLARE
    v_group_id UUID;
    v_acc_id UUID;
    v_cat_food UUID;
    v_cat_salary UUID;
BEGIN
    SELECT id INTO v_group_id FROM family_groups LIMIT 1;
    SELECT id INTO v_acc_id FROM accounts WHERE family_group_id = v_group_id LIMIT 1;
    SELECT id INTO v_cat_food FROM categories WHERE name = 'Alimentação' AND family_group_id = v_group_id;
    SELECT id INTO v_cat_salary FROM categories WHERE name = 'Salário' AND family_group_id = v_group_id;
    
    IF v_group_id IS NOT NULL AND v_acc_id IS NOT NULL THEN
        INSERT INTO recurring_transactions (family_group_id, account_id, category_id, description, amount_cents, transaction_type, frequency, next_date)
        VALUES 
        (v_group_id, v_acc_id, v_cat_food, 'Assinatura Netflix', 5590, 'EXPENSE', 'monthly', (CURRENT_DATE + interval '1 month')),
        (v_group_id, v_acc_id, v_cat_salary, 'Projeção de Salário', 850000, 'INCOME', 'monthly', (CURRENT_DATE + interval '1 month'))
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
