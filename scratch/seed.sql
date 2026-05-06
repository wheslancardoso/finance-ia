-- SQL de Seed para Liquid Glass Finance
-- Popula os dados iniciais para visualização do Dashboard e Contas

DO $$ 
DECLARE
    v_group_id UUID;
    v_user_id UUID;
    v_acc_nubank UUID;
    v_acc_itau UUID;
    v_acc_cash UUID;
    v_cat_food UUID;
    v_cat_leisure UUID;
    v_cat_salary UUID;
BEGIN
    -- 1. Tenta pegar o primeiro usuário cadastrado no sistema (Profiles)
    SELECT id INTO v_user_id FROM profiles LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Nenhum usuário encontrado em profiles. Por favor, crie um usuário antes de rodar o seed.';
        RETURN;
    END IF;

    -- 2. Criar Grupo Familiar
    INSERT INTO family_groups (name) VALUES ('Minha Família') RETURNING id INTO v_group_id;

    -- 3. Vincular usuário ao grupo
    INSERT INTO family_members (family_group_id, user_id, role) 
    VALUES (v_group_id, v_user_id, 'admin');

    -- 4. Criar Contas
    INSERT INTO accounts (family_group_id, name, type, balance_cents, color_hex)
    VALUES (v_group_id, 'Nubank', 'CHECKING', 540000, '#8A05BE') RETURNING id INTO v_acc_nubank;

    INSERT INTO accounts (family_group_id, name, type, balance_cents, color_hex)
    VALUES (v_group_id, 'Itaú', 'CHECKING', 1250050, '#FF7800') RETURNING id INTO v_acc_itau;

    INSERT INTO accounts (family_group_id, name, type, balance_cents, color_hex)
    VALUES (v_group_id, 'Dinheiro', 'CASH', 35000, '#10B981') RETURNING id INTO v_acc_cash;

    -- 5. Criar Categorias
    INSERT INTO categories (family_group_id, name, type, icon_name, color_hex)
    VALUES (v_group_id, 'Alimentação', 'EXPENSE', 'Utensils', '#F87171') RETURNING id INTO v_cat_food;

    INSERT INTO categories (family_group_id, name, type, icon_name, color_hex)
    VALUES (v_group_id, 'Lazer', 'EXPENSE', 'Gamepad', '#60A5FA') RETURNING id INTO v_cat_leisure;

    INSERT INTO categories (family_group_id, name, type, icon_name, color_hex)
    VALUES (v_group_id, 'Salário', 'INCOME', 'Briefcase', '#34D399') RETURNING id INTO v_cat_salary;

    -- 6. Inserir Transações Recentes
    INSERT INTO transactions (account_id, category_id, amount_cents, transaction_type, date, description, merchant_name)
    VALUES (v_acc_nubank, v_cat_food, 12550, 'EXPENSE', now(), 'Almoço Executivo', 'Restaurante Gourmet');

    INSERT INTO transactions (account_id, category_id, amount_cents, transaction_type, date, description, merchant_name)
    VALUES (v_acc_itau, v_cat_salary, 850000, 'INCOME', now() - interval '1 day', 'Salário Mensal', 'Empresa Tech');

    INSERT INTO transactions (account_id, category_id, amount_cents, transaction_type, date, description, merchant_name)
    VALUES (v_acc_nubank, v_cat_leisure, 4590, 'EXPENSE', now() - interval '2 days', 'Assinatura Streaming', 'Netflix');

    INSERT INTO transactions (account_id, category_id, amount_cents, transaction_type, date, description, merchant_name)
    VALUES (v_acc_cash, v_cat_food, 1500, 'EXPENSE', now() - interval '3 days', 'Café na Esquina', 'Padaria Central');

    RAISE NOTICE 'Seed finalizado com sucesso!';
END $$;
