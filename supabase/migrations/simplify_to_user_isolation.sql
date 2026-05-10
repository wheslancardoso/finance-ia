-- MIGRATION: Simplificação para isolamento por Usuário (Removendo Família/Grupos)
-- Este script renomeia family_group_id para user_id e remove as tabelas de família.

BEGIN;

-- 1. Renomear colunas em todas as tabelas
ALTER TABLE public.accounts RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.transactions RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.categories RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.budgets RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.goals RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.recurring_transactions RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.financial_snapshots RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.scheduled_alerts RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.spending_advice_cache RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.whatsapp_sessions RENAME COLUMN family_group_id TO user_id;
ALTER TABLE public.ai_message_log RENAME COLUMN family_group_id TO user_id;

-- 2. Corrigir Foreign Keys
-- Remover FKs antigas que apontavam para family_groups
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_family_group_id_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_family_group_id_fkey;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_family_group_id_fkey;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_family_fkey;
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_family_group_id_fkey;
ALTER TABLE public.recurring_transactions DROP CONSTRAINT IF EXISTS recurring_family_fkey;
ALTER TABLE public.financial_snapshots DROP CONSTRAINT IF EXISTS financial_snapshots_family_fkey;
ALTER TABLE public.scheduled_alerts DROP CONSTRAINT IF EXISTS scheduled_alerts_family_fkey;
ALTER TABLE public.spending_advice_cache DROP CONSTRAINT IF EXISTS spending_advice_cache_family_fkey;
ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_family_fkey;
ALTER TABLE public.ai_message_log DROP CONSTRAINT IF EXISTS ai_message_log_family_fkey;

-- Adicionar novas FKs apontando para profiles(id)
ALTER TABLE public.accounts ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.recurring_transactions ADD CONSTRAINT recurring_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.financial_snapshots ADD CONSTRAINT financial_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_alerts ADD CONSTRAINT scheduled_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.spending_advice_cache ADD CONSTRAINT spending_advice_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.ai_message_log ADD CONSTRAINT ai_message_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Remover tabelas obsoletas
DROP TABLE IF EXISTS public.family_members;
DROP TABLE IF EXISTS public.family_groups;

COMMIT;
