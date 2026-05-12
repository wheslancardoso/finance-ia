-- MIGRATION: Segurança Definitiva - Ativação de RLS e Políticas de Isolamento
-- Objetivo: Garantir que cada usuário acesse apenas seus próprios dados.

BEGIN;

-- 1. Ativar RLS em todas as tabelas core
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- 2. Criar Políticas de Isolamento (auth.uid() = user_id)

-- PROFILES
DROP POLICY IF EXISTS "Users can only see their own profile" ON public.profiles;
CREATE POLICY "Users can only see their own profile" ON public.profiles
    FOR ALL USING (id = auth.uid());

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can only manage their own accounts" ON public.accounts;
CREATE POLICY "Users can only manage their own accounts" ON public.accounts
    FOR ALL USING (user_id = auth.uid());

-- TRANSACTIONS
DROP POLICY IF EXISTS "Users can only manage their own transactions" ON public.transactions;
CREATE POLICY "Users can only manage their own transactions" ON public.transactions
    FOR ALL USING (user_id = auth.uid());

-- CATEGORIES
DROP POLICY IF EXISTS "Users can only manage their own categories" ON public.categories;
CREATE POLICY "Users can only manage their own categories" ON public.categories
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL); -- Permite categorias de sistema

-- GOALS
DROP POLICY IF EXISTS "Users can only manage their own goals" ON public.goals;
CREATE POLICY "Users can only manage their own goals" ON public.goals
    FOR ALL USING (user_id = auth.uid());

-- BUDGETS
DROP POLICY IF EXISTS "Users can only manage their own budgets" ON public.budgets;
CREATE POLICY "Users can only manage their own budgets" ON public.budgets
    FOR ALL USING (user_id = auth.uid());

-- RECURRING TRANSACTIONS
DROP POLICY IF EXISTS "Users can only manage their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can only manage their own recurring transactions" ON public.recurring_transactions
    FOR ALL USING (user_id = auth.uid());

-- CREDIT CARD INVOICES (Proteção via Account)
ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only manage invoices of their own accounts" ON public.credit_card_invoices;
CREATE POLICY "Users can only manage invoices of their own accounts" ON public.credit_card_invoices
    FOR ALL USING (
        account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    );

COMMIT;
