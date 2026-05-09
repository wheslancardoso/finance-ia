-- Seed Data for Local Development
-- 1. User and Profile
INSERT INTO auth.users (email) VALUES ('test@example.com') ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    INSERT INTO public.profiles (id, full_name, preferred_language)
    VALUES (v_user_id, 'Usuário Teste', 'pt-BR')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- 2. Family Group
INSERT INTO public.family_groups (name, monthly_income_cents, accumulated_balance_cents)
VALUES ('Família Teste', 500000, 1000000)
ON CONFLICT DO NOTHING;

-- 3. Link Member
DO $$
DECLARE
    v_user_id UUID;
    v_fg_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    SELECT id INTO v_fg_id FROM public.family_groups LIMIT 1;
    
    INSERT INTO public.family_members (family_group_id, user_id, role)
    VALUES (v_fg_id, v_user_id, 'admin')
    ON CONFLICT DO NOTHING;
END $$;

-- 4. Credit Card Account
DO $$
DECLARE
    v_fg_id UUID;
BEGIN
    SELECT id INTO v_fg_id FROM public.family_groups LIMIT 1;
    
    INSERT INTO public.accounts (family_group_id, name, type, credit_limit_cents, closing_day, due_day, color_hex)
    VALUES (v_fg_id, 'Nubank Teste', 'CREDIT_CARD', 200000, 5, 12, '#8A05BE')
    ON CONFLICT DO NOTHING;
END $$;

-- 5. Categories
DO $$
DECLARE
    v_fg_id UUID;
BEGIN
    SELECT id INTO v_fg_id FROM public.family_groups LIMIT 1;
    
    INSERT INTO public.categories (family_group_id, name, type, icon_name, color_hex)
    VALUES (v_fg_id, 'Alimentação', 'EXPENSE', 'Utensils', '#EF4444')
    ON CONFLICT DO NOTHING;
END $$;
