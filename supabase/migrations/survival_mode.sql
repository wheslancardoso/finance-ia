-- SQL de Migração para o Modo Crise (Fase 4)
-- Rode este script no SQL Editor do seu Supabase.

ALTER TABLE family_groups
ADD COLUMN IF NOT EXISTS monthly_income_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS fixed_expenses_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS accumulated_balance_cents BIGINT DEFAULT 0;

-- Adicionar flag para diferenciar parcelamentos antigos (Custo Fixo mascarado)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_legacy_debt BOOLEAN DEFAULT FALSE;
