-- Migração para Sistema de Orçamentos (Vesper)

-- 1. Criar a tabela de orçamentos
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    period TEXT NOT NULL DEFAULT 'monthly',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Um grupo só pode ter um orçamento por categoria por período
    UNIQUE(family_group_id, category_id, period)
);

-- 2. Habilitar RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
CREATE POLICY "Users can view budgets of their family group" ON budgets
    FOR SELECT USING (
        family_group_id IN (
            SELECT family_group_id FROM family_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage budgets of their family group" ON budgets
    FOR ALL USING (
        family_group_id IN (
            SELECT family_group_id FROM family_members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 4. Inserir dados de teste (Seed para orçamentos)
DO $$ 
DECLARE
    v_group_id UUID;
    v_cat_food UUID;
    v_cat_leisure UUID;
BEGIN
    -- Pega o primeiro grupo familiar existente
    SELECT id INTO v_group_id FROM family_groups LIMIT 1;
    
    IF v_group_id IS NOT NULL THEN
        -- Pega as categorias correspondentes
        SELECT id INTO v_cat_food FROM categories WHERE name = 'Alimentação' AND family_group_id = v_group_id;
        SELECT id INTO v_cat_leisure FROM categories WHERE name = 'Lazer' AND family_group_id = v_group_id;

        -- Insere orçamentos se as categorias existirem
        IF v_cat_food IS NOT NULL THEN
            INSERT INTO budgets (family_group_id, category_id, amount_cents, period)
            VALUES (v_group_id, v_cat_food, 150000, 'monthly') -- R$ 1.500,00
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_cat_leisure IS NOT NULL THEN
            INSERT INTO budgets (family_group_id, category_id, amount_cents, period)
            VALUES (v_group_id, v_cat_leisure, 60000, 'monthly') -- R$ 600,00
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
