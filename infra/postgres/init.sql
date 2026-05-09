-- ============================================================
-- 🌌 VESPER FINANCE — CONSOLIDATED INITIALIZATION (LOCAL DEV)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PostgREST Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon nologin;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator noinherit login password 'vesper_secret_password';
    END IF;
END $$;
GRANT anon TO authenticator;

-- Schema Auth (Simulating Supabase)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    encrypted_password TEXT,
    email_confirmed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock auth.uid() for Local Development
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    -- In local dev, we return the first user's ID
    SELECT id FROM auth.users LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Schema Public
CREATE SCHEMA IF NOT EXISTS public;

-- 1. Family Groups
CREATE TABLE IF NOT EXISTS public.family_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    monthly_income_cents BIGINT DEFAULT 0,
    accumulated_balance_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    avatar_url TEXT,
    whatsapp_number TEXT UNIQUE,
    preferred_language TEXT DEFAULT 'pt-BR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Family Members
CREATE TABLE IF NOT EXISTS public.family_members (
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin',
    PRIMARY KEY (family_group_id, user_id)
);

-- 4. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    parent_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'INCOME', 'EXPENSE', 'TRANSFER'
    icon_name VARCHAR(50),
    color_hex VARCHAR(7),
    is_system_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH'
    currency_code VARCHAR(3) DEFAULT 'BRL',
    balance_cents BIGINT DEFAULT 0,
    credit_limit_cents BIGINT DEFAULT 0,
    closing_day INTEGER CHECK (closing_day >= 1 AND closing_day <= 31),
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    color_hex VARCHAR(7) DEFAULT '#7C3AED',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Credit Card Invoices
CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    reference_month CHARACTER VARYING NOT NULL, -- 'YYYY-MM'
    closing_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status CHARACTER VARYING DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PAID')),
    amount_cents BIGINT DEFAULT 0,
    paid_amount_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Goals
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount_cents BIGINT NOT NULL,
    current_amount_cents BIGINT DEFAULT 0,
    deadline DATE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    color_hex VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES public.credit_card_invoices(id) ON DELETE SET NULL,
    goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    amount_cents BIGINT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'INCOME', 'EXPENSE', 'TRANSFER'
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    description VARCHAR(255) NOT NULL,
    merchant_name VARCHAR(150),
    installment_current INT DEFAULT 1,
    installment_total INT DEFAULT 1,
    installment_group_id UUID,
    linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    is_pending BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'MANUAL',
    source_metadata JSONB DEFAULT '{}'::jsonb,
    wa_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Recurring Transactions
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount_cents BIGINT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly'
    next_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    limit_cents BIGINT NOT NULL,
    period VARCHAR(20) DEFAULT 'MONTHLY',
    start_date DATE NOT NULL,
    end_date DATE,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. WhatsApp & AI Tables
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_group_id     UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  wa_id               TEXT        NOT NULL UNIQUE,
  context_state       JSONB       NOT NULL DEFAULT '{"step": "idle"}'::jsonb,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.n8n_webhook_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  TEXT        NOT NULL UNIQUE,
  event_type       TEXT        NOT NULL,
  raw_payload      JSONB       NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  retry_count      INTEGER     NOT NULL DEFAULT 0,
  error_log        TEXT,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_message_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id       UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  profile_id            UUID        REFERENCES public.profiles(id),
  wa_message_id         TEXT,
  sender                TEXT        NOT NULL CHECK (sender IN ('user', 'ai', 'system')),
  content_type          TEXT        NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'audio', 'image', 'document')),
  raw_content           TEXT,
  media_url             TEXT,
  processing_status     TEXT        NOT NULL DEFAULT 'success' CHECK (processing_status IN ('pending', 'processing', 'success', 'failed', 'duplicate')),
  processing_time_ms    INTEGER,
  tokens_used           INTEGER     DEFAULT 0,
  extracted_payload     JSONB       DEFAULT '{}'::jsonb,
  linked_transaction_id UUID        REFERENCES public.transactions(id) ON DELETE SET NULL,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id                      UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id         UUID   NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  snapshot_date           DATE   NOT NULL DEFAULT CURRENT_DATE,
  total_liquid_cents      BIGINT NOT NULL DEFAULT 0,
  total_credit_debt_cents BIGINT NOT NULL DEFAULT 0,
  net_worth_cents         BIGINT NOT NULL DEFAULT 0,
  monthly_income_cents    BIGINT NOT NULL DEFAULT 0,
  monthly_committed_cents BIGINT NOT NULL DEFAULT 0,
  free_cash_cents         BIGINT NOT NULL DEFAULT 0,
  daily_safe_spend_cents  BIGINT NOT NULL DEFAULT 0,
  payload                 JSONB  NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_snapshots_group_date UNIQUE (family_group_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.spending_advice_cache (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  context_hash    TEXT        NOT NULL,
  advice_text     TEXT        NOT NULL,
  impact_analysis JSONB,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT spending_advice_cache_hash_key UNIQUE (family_group_id, context_hash)
);

-- Indices
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_wa_message_id ON public.transactions (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group ON public.transactions (installment_group_id) WHERE installment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_family_month ON public.transactions (family_group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_family ON public.whatsapp_sessions (family_group_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_log_family ON public.ai_message_log (family_group_id, created_at DESC);

-- ============================================================
-- BLOCO: FUNÇÕES E TRIGGERS (CONSOLIDADO FASE 4/5)
-- ============================================================

-- Helper: Data segura
CREATE OR REPLACE FUNCTION public.fn_safe_date(p_year int, p_month int, p_day int)
RETURNS DATE AS $$
DECLARE
    v_first_of_month DATE;
    v_last_of_month DATE;
BEGIN
    v_first_of_month := make_date(p_year, p_month, 1);
    v_last_of_month := (v_first_of_month + interval '1 month' - interval '1 day')::date;
    IF p_day > extract(day from v_last_of_month) THEN
        RETURN v_last_of_month;
    ELSE
        RETURN make_date(p_year, p_month, p_day);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 0.1 Helper — Gerar Datas Seguras
CREATE OR REPLACE FUNCTION public.fn_safe_date(p_year int, p_month int, p_day int)
RETURNS DATE AS $$
DECLARE
    v_first_of_month DATE;
    v_last_of_month DATE;
BEGIN
    v_first_of_month := make_date(p_year, p_month, 1);
    v_last_of_month := (v_first_of_month + interval '1 month' - interval '1 day')::date;
    IF p_day > extract(day from v_last_of_month) THEN
        RETURN v_last_of_month;
    ELSE
        RETURN make_date(p_year, p_month, p_day);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Atualização de Saldo em Contas
CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type TEXT;
  v_delta        BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
    IF v_account_type = 'CREDIT_CARD' THEN RETURN OLD; END IF;
    IF OLD.transaction_type = 'INCOME' THEN
      UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
    ELSIF OLD.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
      UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    IF v_account_type = 'CREDIT_CARD' THEN RETURN NEW; END IF;
    IF NEW.transaction_type = 'INCOME' THEN
      UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
      UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
      -- Reverter antiga
      SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
      IF v_account_type != 'CREDIT_CARD' THEN
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
      END IF;
      -- Aplicar nova
      SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
      IF v_account_type != 'CREDIT_CARD' THEN
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    IF v_account_type = 'CREDIT_CARD' THEN RETURN NEW; END IF;

    v_delta := NEW.amount_cents - OLD.amount_cents;
    IF NEW.transaction_type = 'INCOME' AND OLD.transaction_type = 'INCOME' THEN
      UPDATE public.accounts SET balance_cents = balance_cents + v_delta WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type IN ('EXPENSE','TRANSFER') AND OLD.transaction_type IN ('EXPENSE','TRANSFER') THEN
      UPDATE public.accounts SET balance_cents = balance_cents - v_delta WHERE id = NEW.account_id;
    ELSE
      -- Tipo mudou
      IF OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
      ELSE
        UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
      END IF;
      IF NEW.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
      ELSE
        UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_account_balance AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.fn_update_account_balance();

-- Trigger de Vínculo de Transação a Fatura
CREATE OR REPLACE FUNCTION public.trg_link_credit_card_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_account_type VARCHAR;
    v_closing_day INT;
    v_due_day INT;
    v_base_date DATE;
    v_test_closing_date DATE;
    v_invoice_month DATE;
    v_invoice_due_date DATE;
    v_reference_month VARCHAR(7);
    v_invoice_id UUID;
BEGIN
    SELECT type, closing_day, due_day INTO v_account_type, v_closing_day, v_due_day
    FROM public.accounts WHERE id = NEW.account_id;

    IF v_account_type != 'CREDIT_CARD' OR v_closing_day IS NULL THEN
        RETURN NEW;
    END IF;

    v_base_date := NEW.date::DATE;
    v_test_closing_date := public.fn_safe_date(extract(year from v_base_date)::int, extract(month from v_base_date)::int, v_closing_day);

    IF v_base_date <= v_test_closing_date THEN
        v_invoice_month := v_test_closing_date;
    ELSE
        v_invoice_month := v_test_closing_date + interval '1 month';
    END IF;

    IF v_due_day < v_closing_day THEN
        v_invoice_due_date := public.fn_safe_date(extract(year from v_invoice_month + interval '1 month')::int, extract(month from v_invoice_month + interval '1 month')::int, v_due_day);
    ELSE
        v_invoice_due_date := public.fn_safe_date(extract(year from v_invoice_month)::int, extract(month from v_invoice_month)::int, v_due_day);
    END IF;

    v_reference_month := to_char(v_invoice_due_date, 'YYYY-MM');

    SELECT id INTO v_invoice_id FROM public.credit_card_invoices
    WHERE account_id = NEW.account_id AND reference_month = v_reference_month;

    IF v_invoice_id IS NULL THEN
        INSERT INTO public.credit_card_invoices (account_id, reference_month, closing_date, due_date, amount_cents, status)
        VALUES (NEW.account_id, v_reference_month, 
                public.fn_safe_date(extract(year from v_invoice_month)::int, extract(month from v_invoice_month)::int, v_closing_day), 
                v_invoice_due_date, 0, 'OPEN')
        RETURNING id INTO v_invoice_id;
    END IF;

    NEW.invoice_id := v_invoice_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_credit_card_tx ON public.transactions;
CREATE TRIGGER trg_on_credit_card_tx
BEFORE INSERT OR UPDATE OF date, account_id, invoice_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_link_credit_card_transaction();

-- Trigger de Soma de Totais na Fatura
CREATE OR REPLACE FUNCTION public.trg_update_invoice_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.invoice_id IS NOT NULL THEN
            UPDATE public.credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions WHERE invoice_id = OLD.invoice_id)
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE public.credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions WHERE invoice_id = NEW.invoice_id)
            WHERE id = NEW.invoice_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_amount_after ON public.transactions;
CREATE TRIGGER trg_update_invoice_amount_after
AFTER INSERT OR UPDATE OF amount_cents, invoice_id OR DELETE
ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.trg_update_invoice_amount();

-- RPC: Get Financial State V3
CREATE OR REPLACE FUNCTION public.get_financial_state_v3(p_family_group_id UUID, p_target_month TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_result JSONB;
  v_month_start TIMESTAMPTZ := date_trunc('month', p_target_month);
  v_month_end TIMESTAMPTZ := v_month_start + interval '1 month' - interval '1 second';
BEGIN
  SELECT jsonb_build_object(
    'family_group', (SELECT jsonb_build_object('id', id, 'name', name, 'monthly_income_cents', COALESCE(monthly_income_cents, 0), 'accumulated_balance_cents', COALESCE(accumulated_balance_cents, 0)) FROM public.family_groups WHERE id = p_family_group_id),
    'accounts', (SELECT COALESCE(jsonb_agg(a ORDER BY a.name), '[]'::jsonb) FROM (SELECT id, name, type, balance_cents, credit_limit_cents, color_hex, is_active, closing_day, due_day, currency_code FROM public.accounts WHERE family_group_id = p_family_group_id AND is_active = true) a),
    'invoices', (SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) FROM (SELECT i.* FROM public.credit_card_invoices i JOIN public.accounts a ON i.account_id = a.id WHERE a.family_group_id = p_family_group_id AND i.status IN ('OPEN', 'CLOSED')) i),
    'goals', (SELECT COALESCE(jsonb_agg(g ORDER BY g.deadline ASC NULLS LAST), '[]'::jsonb) FROM (SELECT * FROM public.goals WHERE family_group_id = p_family_group_id AND status = 'active') g),
    'recent_transactions', (SELECT COALESCE(jsonb_agg(t ORDER BY t.date DESC, t.created_at DESC), '[]'::jsonb) FROM (SELECT t.*, c.name AS category_name, c.icon_name AS category_icon, acc.name AS account_name FROM public.transactions t LEFT JOIN public.categories c ON t.category_id = c.id LEFT JOIN public.accounts acc ON t.account_id = acc.id WHERE t.family_group_id = p_family_group_id LIMIT 50) t)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Seed Data
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, full_name) VALUES ('00000000-0000-0000-0000-000000000001', 'Usuário Teste') ON CONFLICT DO NOTHING;
INSERT INTO public.family_groups (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Minha Família') ON CONFLICT DO NOTHING;
INSERT INTO public.family_members (family_group_id, user_id, role) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin') ON CONFLICT DO NOTHING;

-- Categorias Padrão
INSERT INTO public.categories (family_group_id, name, type, icon_name, color_hex, is_system_default) VALUES
('00000000-0000-0000-0000-000000000001', 'Salário', 'INCOME', 'Briefcase', '#10B981', true),
('00000000-0000-0000-0000-000000000001', 'Alimentação', 'EXPENSE', 'Utensils', '#F59E0B', true),
('00000000-0000-0000-0000-000000000001', 'Transporte', 'EXPENSE', 'Car', '#3B82F6', true),
('00000000-0000-0000-0000-000000000001', 'Lazer', 'EXPENSE', 'Pizza', '#8B5CF6', true),
('00000000-0000-0000-0000-000000000001', 'Saúde', 'EXPENSE', 'Heart', '#EF4444', true)
ON CONFLICT DO NOTHING;

-- Contas Iniciais
INSERT INTO public.accounts (id, family_group_id, name, type, balance_cents, color_hex) VALUES
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Conta Corrente', 'CHECKING', 100000, '#7C3AED')
ON CONFLICT DO NOTHING;

INSERT INTO public.accounts (id, family_group_id, name, type, credit_limit_cents, closing_day, due_day, color_hex) VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Cartão Vesper', 'CREDIT_CARD', 500000, 5, 12, '#1E293B')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RPCs CONSOLIDADAS (V6)
-- ============================================================

-- 1. get_month_projection
CREATE OR REPLACE FUNCTION public.get_month_projection(
    p_family_group_id UUID, 
    p_target_month DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_month_start DATE := date_trunc('month', p_target_month)::date;
    v_month_end DATE := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 day')::date;
    v_income_total BIGINT;
    v_expense_total BIGINT;
    v_balance_current BIGINT;
    v_projected_balance BIGINT;
BEGIN
    SELECT COALESCE(SUM(balance_cents), 0) INTO v_balance_current
    FROM public.accounts
    WHERE family_group_id = p_family_group_id AND type != 'CREDIT_CARD' AND is_active = true;

    SELECT COALESCE(SUM(amount_cents), 0) INTO v_income_total
    FROM public.transactions
    WHERE family_group_id = p_family_group_id 
    AND date >= v_month_start AND date <= v_month_end
    AND transaction_type = 'INCOME';

    SELECT COALESCE(SUM(amount_cents), 0) INTO v_expense_total
    FROM public.transactions
    WHERE family_group_id = p_family_group_id 
    AND date >= v_month_start AND date <= v_month_end
    AND transaction_type = 'EXPENSE'
    AND account_id IN (SELECT id FROM public.accounts WHERE family_group_id = p_family_group_id AND type != 'CREDIT_CARD');

    v_projected_balance := v_balance_current + v_income_total - v_expense_total;

    RETURN json_build_object(
        'projection', json_build_object(
            'month_start', v_month_start,
            'month_end', v_month_end,
            'current_balance_cents', v_balance_current,
            'projected_income_cents', v_income_total,
            'projected_expense_cents', v_expense_total,
            'projected_end_balance_cents', v_projected_balance
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. get_financial_state_v5
CREATE OR REPLACE FUNCTION public.get_financial_state_v5(
    p_family_group_id UUID, 
    p_target_month TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_month_start DATE := date_trunc('month', p_target_month)::date;
    v_month_end DATE := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 day')::date;
BEGIN
    SELECT json_build_object(
        'family_group', (
            SELECT row_to_json(fg) FROM public.family_groups fg WHERE id = p_family_group_id
        ),
        'accounts', (
            SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json) FROM public.accounts a 
            WHERE family_group_id = p_family_group_id AND is_active = true
        ),
        'invoices', (
            SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM public.credit_card_invoices i 
            JOIN public.accounts a ON i.account_id = a.id 
            WHERE a.family_group_id = p_family_group_id AND i.status != 'PAID'
        ),
        'goals', (
            SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json) FROM public.goals g 
            WHERE family_group_id = p_family_group_id AND status = 'active'
        ),
        'recurring_transactions', (
            SELECT COALESCE(json_agg(rt_joined), '[]'::json) FROM (
                SELECT rt.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.recurring_transactions rt
                LEFT JOIN public.categories c ON rt.category_id = c.id
                LEFT JOIN public.accounts a ON rt.account_id = a.id
                WHERE rt.family_group_id = p_family_group_id AND rt.status = 'active'
            ) rt_joined
        ),
        'budgets', (
            SELECT COALESCE(json_agg(row_to_json(b)), '[]'::json) FROM public.budgets b 
            WHERE family_group_id = p_family_group_id
        ),
        'recent_transactions', (
            SELECT COALESCE(json_agg(t_joined), '[]'::json) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = p_family_group_id
                ORDER BY t.date DESC
                LIMIT 50
            ) t_joined
        ),
        'month_transactions', (
            SELECT COALESCE(json_agg(t_joined), '[]'::json) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = p_family_group_id
                AND t.date >= v_month_start AND t.date <= v_month_end
                ORDER BY t.date DESC
            ) t_joined
        ),
        'month_stats', (
            SELECT json_build_object(
                'income', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'INCOME'), 0),
                'expense', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'EXPENSE'), 0),
                'debit_expense', COALESCE(SUM(amount_cents) FILTER (
                    WHERE transaction_type = 'EXPENSE' 
                    AND account_id IN (SELECT id FROM public.accounts WHERE family_group_id = p_family_group_id AND type != 'CREDIT_CARD')
                ), 0)
            )
            FROM public.transactions
            WHERE family_group_id = p_family_group_id 
            AND date >= v_month_start AND date <= v_month_end
            AND is_paid = true
        ),
        'categories', (
            SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM public.categories c 
            WHERE family_group_id = p_family_group_id OR is_system_default = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. fn_get_goal_recommendations
CREATE OR REPLACE FUNCTION public.fn_get_goal_recommendations(
  p_family_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projection JSONB;
  v_surplus BIGINT;
  v_goal RECORD;
  v_recommendations JSONB := '[]'::jsonb;
  v_amount_to_allocate BIGINT;
  v_remaining_surplus BIGINT;
BEGIN
  v_projection := public.get_month_projection(p_family_group_id, CURRENT_DATE);
  v_surplus := (v_projection->'projection'->>'projected_end_balance_cents')::bigint;
  v_remaining_surplus := COALESCE(v_surplus, 0);

  IF v_remaining_surplus <= 0 THEN
    RETURN jsonb_build_object(
      'surplus_cents', v_surplus,
      'recommendations', v_recommendations,
      'message', 'Sem sobra livre projetada para este mês.'
    );
  END IF;

  FOR v_goal IN (
    SELECT id, name, target_amount_cents, current_amount_cents, monthly_contribution_cents, priority
    FROM public.goals
    WHERE family_group_id = p_family_group_id
      AND status = 'active'
      AND current_amount_cents < target_amount_cents
    ORDER BY COALESCE(priority, 999) ASC, created_at ASC
  ) LOOP
    v_amount_to_allocate := COALESCE(v_goal.monthly_contribution_cents, 0);
    IF v_remaining_surplus < v_amount_to_allocate THEN v_amount_to_allocate := v_remaining_surplus; END IF;
    IF v_amount_to_allocate > 0 THEN
      v_recommendations := v_recommendations || jsonb_build_object(
        'goal_id', v_goal.id,
        'goal_name', v_goal.name,
        'recommended_amount_cents', v_amount_to_allocate,
        'is_full_target', v_amount_to_allocate = v_goal.monthly_contribution_cents
      );
      v_remaining_surplus := v_remaining_surplus - v_amount_to_allocate;
    END IF;
    EXIT WHEN v_remaining_surplus <= 0;
  END LOOP;

  RETURN jsonb_build_object(
    'surplus_cents', v_surplus,
    'remaining_surplus_cents', v_remaining_surplus,
    'recommendations', v_recommendations
  );
END;
$$;

-- 4. fn_simulate_spending
CREATE OR REPLACE FUNCTION public.fn_simulate_spending(
  p_family_group_id UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projection JSONB;
  v_current_surplus BIGINT;
  v_new_surplus BIGINT;
  v_status TEXT;
  v_message TEXT;
BEGIN
  v_projection := public.get_month_projection(p_family_group_id, CURRENT_DATE);
  v_current_surplus := (v_projection->'projection'->>'projected_end_balance_cents')::bigint;
  v_new_surplus := COALESCE(v_current_surplus, 0) - p_amount_cents;

  IF v_new_surplus < 0 THEN
    v_status := 'DANGER';
    v_message := 'Este gasto deixará seu saldo negativo no fim do mês!';
  ELSIF v_new_surplus < (COALESCE(v_current_surplus, 0) * 0.2) THEN
    v_status := 'WARNING';
    v_message := 'Cuidado, este gasto consome quase toda sua sobra livre.';
  ELSE
    v_status := 'SAFE';
    v_message := 'Gasto dentro da margem de segurança.';
  END IF;

  RETURN jsonb_build_object(
    'current_surplus_cents', v_current_surplus,
    'simulated_surplus_cents', v_new_surplus,
    'status', v_status,
    'message', v_message,
    'impact_percentage', CASE WHEN COALESCE(v_current_surplus, 0) > 0 THEN ROUND((p_amount_cents::numeric / v_current_surplus::numeric) * 100, 2) ELSE 100 END
  );
END;
$$;

-- Grants for PostgREST
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO anon;

-- Universal Permissions for RPCs
GRANT EXECUTE ON FUNCTION public.get_month_projection TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_state_v5 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_goal_recommendations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_simulate_spending TO anon, authenticated, service_role;
