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
    financial_health_score INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- 6. Invoices (Renamed from credit_card_invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    reference_month CHARACTER VARYING NOT NULL, -- 'YYYY-MM'
    closing_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status CHARACTER VARYING DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PAID')),
    amount_cents BIGINT DEFAULT 0,
    paid_amount_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
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
-- BLOCO: FUNÇÕES E TRIGGERS (CONSOLIDADO)
-- ============================================================

-- Trigger: auto update updated_at
CREATE OR REPLACE FUNCTION public.fn_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_family_groups_updated_at BEFORE UPDATE ON public.family_groups FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at_column();
CREATE TRIGGER tr_update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at_column();
CREATE TRIGGER tr_update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at_column();
CREATE TRIGGER tr_update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at_column();
CREATE TRIGGER tr_update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at_column();

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

-- Trigger: Atualização de Saldo em Contas (Incluso Cartão de Crédito)
CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type TEXT;
  v_delta        BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
    IF v_account_type = 'CREDIT_CARD' THEN
      -- Para cartão, balance_cents representa a dívida (positivo = dívida)
      IF OLD.transaction_type = 'INCOME' THEN -- Pagamento da fatura
        UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
      ELSE
        UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
      END IF;
    ELSE
      IF OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
      ELSE
        UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    IF v_account_type = 'CREDIT_CARD' THEN
      IF NEW.transaction_type = 'INCOME' THEN -- Pagamento da fatura
        UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
      ELSE
        UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
      END IF;
    ELSE
      IF NEW.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
      ELSE
        UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
      -- Reverter antiga
      SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
      IF v_account_type = 'CREDIT_CARD' THEN
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
      ELSE
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
      END IF;
      -- Aplicar nova
      SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
      IF v_account_type = 'CREDIT_CARD' THEN
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      ELSE
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    v_delta := NEW.amount_cents - OLD.amount_cents;

    IF v_account_type = 'CREDIT_CARD' THEN
      IF NEW.transaction_type = 'INCOME' AND OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - v_delta WHERE id = NEW.account_id;
      ELSIF NEW.transaction_type != 'INCOME' AND OLD.transaction_type != 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + v_delta WHERE id = NEW.account_id;
      ELSE
        -- Tipo mudou (ex: Income -> Expense)
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = NEW.account_id;
        END IF;
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;
    ELSE
      IF NEW.transaction_type = 'INCOME' AND OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + v_delta WHERE id = NEW.account_id;
      ELSIF NEW.transaction_type != 'INCOME' AND OLD.transaction_type != 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - v_delta WHERE id = NEW.account_id;
      ELSE
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = NEW.account_id;
        END IF;
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_account_balance ON public.transactions;
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

    -- Se a transação for após o fechamento, cai na próxima fatura
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

    SELECT id INTO v_invoice_id FROM public.invoices
    WHERE account_id = NEW.account_id AND reference_month = v_reference_month;

    IF v_invoice_id IS NULL THEN
        INSERT INTO public.invoices (account_id, reference_month, closing_date, due_date, amount_cents, status)
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
            UPDATE public.invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions WHERE invoice_id = OLD.invoice_id)
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE public.invoices
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

-- Trigger de Atualização Automática de Status de Fatura
CREATE OR REPLACE FUNCTION public.trg_auto_close_invoices()
RETURNS TRIGGER AS $$
BEGIN
    -- Se hoje passou da data de fechamento, e status é OPEN, vira CLOSED
    UPDATE public.invoices 
    SET status = 'CLOSED' 
    WHERE status = 'OPEN' AND closing_date < CURRENT_DATE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Executa a cada transação ou quando necessário
-- Em um ambiente real, isso seria um cron, mas para dev local podemos atrelar a transações
CREATE TRIGGER trg_check_invoice_status AFTER INSERT ON public.transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_auto_close_invoices();

-- RPC: get_financial_state_v5 (Melhorado para Cartão de Crédito)
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
    -- Atualiza status de faturas antes de retornar
    UPDATE public.invoices 
    SET status = 'CLOSED' 
    WHERE status = 'OPEN' AND closing_date < CURRENT_DATE;

    SELECT json_build_object(
        'family_group', (
            SELECT json_build_object(
                'id', fg.id,
                'name', fg.name,
                'monthly_income_cents', fg.monthly_income_cents,
                'accumulated_balance_cents', fg.accumulated_balance_cents,
                'financial_health_score', COALESCE(fg.financial_health_score, 100)
            ) FROM public.family_groups fg WHERE id = p_family_group_id
        ),
        'accounts', (
            SELECT COALESCE(json_agg(row_to_json(a_with_invoices)), '[]'::json) 
            FROM (
                SELECT a.*,
                    (SELECT COALESCE(SUM(amount_cents), 0) FROM public.invoices WHERE account_id = a.id AND status = 'OPEN') as open_invoice_cents,
                    (SELECT COALESCE(SUM(amount_cents), 0) FROM public.invoices WHERE account_id = a.id AND status = 'CLOSED') as closed_invoice_cents,
                    (SELECT reference_month FROM public.invoices WHERE account_id = a.id AND status = 'OPEN' ORDER BY closing_date ASC LIMIT 1) as open_invoice_month,
                    (SELECT reference_month FROM public.invoices WHERE account_id = a.id AND status = 'CLOSED' ORDER BY closing_date DESC LIMIT 1) as closed_invoice_month
                FROM public.accounts a 
                WHERE family_group_id = p_family_group_id AND is_active = true
            ) a_with_invoices
        ),
        'invoices', (
            SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM public.invoices i 
            JOIN public.accounts a ON i.account_id = a.id 
            WHERE a.family_group_id = p_family_group_id AND i.status != 'PAID'
        ),
        'goals', (
            SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json) FROM public.goals g 
            WHERE family_group_id = p_family_group_id AND status = 'active'
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
        'categories', (
            SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM public.categories c 
            WHERE family_group_id = p_family_group_id OR is_system_default = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
-- BLOCO: RPCs DE NEGÓCIO (PARCELAMENTO E TRANSFERÊNCIA)
-- ============================================================

-- Helper: Encontrar ou Criar Fatura
CREATE OR REPLACE FUNCTION public.fn_get_or_create_invoice(
  p_account_id  UUID,
  p_purchase_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_closing_day     INTEGER;
  v_due_day         INTEGER;
  v_billing_year    INTEGER;
  v_billing_month   INTEGER;
  v_billing_label   TEXT;
  v_closing_date    DATE;
  v_due_date        DATE;
  v_invoice_id      UUID;
BEGIN
  SELECT closing_day, due_day INTO v_closing_day, v_due_day
  FROM public.accounts WHERE id = p_account_id AND type = 'CREDIT_CARD';

  IF v_closing_day IS NULL THEN RETURN NULL; END IF;

  IF EXTRACT(DAY FROM p_purchase_date) >= v_closing_day THEN
    v_billing_year  := EXTRACT(YEAR  FROM p_purchase_date + interval '1 month');
    v_billing_month := EXTRACT(MONTH FROM p_purchase_date + interval '1 month');
  ELSE
    v_billing_year  := EXTRACT(YEAR  FROM p_purchase_date);
    v_billing_month := EXTRACT(MONTH FROM p_purchase_date);
  END IF;

  v_billing_label := to_char(make_date(v_billing_year, v_billing_month, 1), 'YYYY-MM');
  v_closing_date := public.fn_safe_date(v_billing_year, v_billing_month, v_closing_day);

  IF v_due_day IS NULL THEN
    v_due_date := v_closing_date + interval '10 days';
  ELSE
    DECLARE
      v_due_month INTEGER := v_billing_month;
      v_due_year  INTEGER := v_billing_year;
    BEGIN
      IF v_due_day < v_closing_day THEN
        v_due_month := v_due_month + 1;
        IF v_due_month > 12 THEN
          v_due_month := 1; v_due_year := v_due_year + 1;
        END IF;
      END IF;
      v_due_date := public.fn_safe_date(v_due_year, v_due_month, v_due_day);
    END;
  END IF;

  SELECT id INTO v_invoice_id FROM public.invoices
  WHERE account_id = p_account_id AND reference_month = v_billing_label LIMIT 1;

  IF v_invoice_id IS NULL THEN
    INSERT INTO public.invoices (account_id, reference_month, closing_date, due_date, status, amount_cents)
    VALUES (p_account_id, v_billing_label, v_closing_date, v_due_date, 'OPEN', 0)
    RETURNING id INTO v_invoice_id;
  END IF;

  RETURN v_invoice_id;
END;
$$;

-- RPC: create_installment_series
CREATE OR REPLACE FUNCTION public.create_installment_series(
  p_account_id      UUID,
  p_category_id     UUID,
  p_description     TEXT,
  p_merchant_name   TEXT       DEFAULT NULL,
  p_total_cents     BIGINT     DEFAULT 0,
  p_installments    INTEGER    DEFAULT 1,
  p_purchase_date   TIMESTAMPTZ DEFAULT NOW(),
  p_source          TEXT       DEFAULT 'MANUAL',
  p_family_group_id UUID       DEFAULT NULL,
  p_source_metadata JSONB      DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id          UUID := gen_random_uuid();
  v_installment_cents BIGINT;
  v_remainder_cents   BIGINT;
  v_current_amount    BIGINT;
  v_current_date      TIMESTAMPTZ;
  v_invoice_id        UUID;
  v_transaction_id    UUID;
  v_i                 INTEGER;
  v_inserted_ids      UUID[] := '{}';
  v_account_type      TEXT;
BEGIN
  IF p_installments < 1 OR p_installments > 48 THEN
    RAISE EXCEPTION 'Parcelas entre 1 e 48. Recebido: %', p_installments;
  END IF;
  
  SELECT type INTO v_account_type FROM public.accounts WHERE id = p_account_id;
  IF v_account_type IS DISTINCT FROM 'CREDIT_CARD' THEN
    RAISE EXCEPTION 'Apenas para CREDIT_CARD. Tipo: %', v_account_type;
  END IF;

  v_installment_cents := p_total_cents / p_installments;
  v_remainder_cents   := p_total_cents - (v_installment_cents * p_installments);

  FOR v_i IN 1..p_installments LOOP
    v_current_date := p_purchase_date + ((v_i - 1) * interval '1 month');
    v_current_amount := CASE WHEN v_i = 1 THEN v_installment_cents + v_remainder_cents ELSE v_installment_cents END;
    v_invoice_id := public.fn_get_or_create_invoice(p_account_id, v_current_date);

    INSERT INTO public.transactions (
      account_id, category_id, amount_cents, transaction_type, date, description, merchant_name,
      installment_current, installment_total, installment_group_id, invoice_id, source, source_metadata, family_group_id
    ) VALUES (
      p_account_id, p_category_id, v_current_amount, 'EXPENSE', v_current_date, 
      p_description || ' (' || v_i || '/' || p_installments || ')', p_merchant_name,
      v_i, p_installments, v_group_id, v_invoice_id, p_source, p_source_metadata, p_family_group_id
    ) RETURNING id INTO v_transaction_id;

    v_inserted_ids := array_append(v_inserted_ids, v_transaction_id);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'installment_group_id', v_group_id, 'transaction_ids', to_jsonb(v_inserted_ids));
END;
$$;

-- RPC: create_transfer
CREATE OR REPLACE FUNCTION public.create_transfer(
  p_from_account_id UUID,
  p_to_account_id   UUID,
  p_amount_cents    BIGINT,
  p_description     TEXT,
  p_date            TIMESTAMPTZ DEFAULT NOW(),
  p_category_id     UUID        DEFAULT NULL,
  p_family_group_id UUID        DEFAULT NULL,
  p_source          TEXT        DEFAULT 'MANUAL'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_out_id UUID;
  v_in_id  UUID;
BEGIN
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Contas iguais.'; END IF;

  INSERT INTO public.transactions (account_id, category_id, amount_cents, transaction_type, date, description, source, family_group_id)
  VALUES (p_from_account_id, p_category_id, p_amount_cents, 'TRANSFER', p_date, p_description, p_source, p_family_group_id)
  RETURNING id INTO v_out_id;

  INSERT INTO public.transactions (account_id, category_id, amount_cents, transaction_type, date, description, source, family_group_id, linked_transaction_id)
  VALUES (p_to_account_id, p_category_id, p_amount_cents, 'INCOME', p_date, p_description, p_source, p_family_group_id, v_out_id)
  RETURNING id INTO v_in_id;

  UPDATE public.transactions SET linked_transaction_id = v_in_id WHERE id = v_out_id;
  RETURN jsonb_build_object('success', true, 'out_id', v_out_id, 'in_id', v_in_id);
END;
$$;

-- RPC: delete_installment_series
CREATE OR REPLACE FUNCTION public.delete_installment_series(
  p_group_id        UUID,
  p_delete_from     INTEGER    DEFAULT 1,
  p_family_group_id UUID       DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM public.transactions
  WHERE installment_group_id = p_group_id AND installment_current >= p_delete_from
    AND (p_family_group_id IS NULL OR family_group_id = p_family_group_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

-- RPC: get_installment_series
CREATE OR REPLACE FUNCTION public.get_installment_series(p_group_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN jsonb_build_object(
    'installments', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.installment_current), '[]'::jsonb)
      FROM (
        SELECT t.id, t.installment_current, t.installment_total, t.amount_cents, t.date, t.description, t.invoice_id, t.is_paid, i.reference_month, i.status AS invoice_status
        FROM public.transactions t LEFT JOIN public.invoices i ON t.invoice_id = i.id
        WHERE t.installment_group_id = p_group_id ORDER BY t.installment_current
      ) t
    ),
    'summary', (
      SELECT jsonb_build_object('total_cents', SUM(amount_cents), 'paid_count', COUNT(*) FILTER (WHERE is_paid = true), 'remaining_count', COUNT(*) FILTER (WHERE is_paid = false))
      FROM public.transactions WHERE installment_group_id = p_group_id
    )
  );
END;
$$;

-- RPC: get_month_projection
CREATE OR REPLACE FUNCTION public.get_month_projection(
  p_family_group_id UUID,
  p_target_month    DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_month_start    TIMESTAMPTZ := date_trunc('month', p_target_month::timestamptz);
  v_month_end      TIMESTAMPTZ := v_month_start + interval '1 month' - interval '1 second';
BEGIN
  RETURN jsonb_build_object(
    'target_month', to_char(v_month_start, 'YYYY-MM'),
    'current_liquid_cents', (
      SELECT COALESCE(SUM(balance_cents), 0)
      FROM public.accounts
      WHERE family_group_id = p_family_group_id AND type != 'CREDIT_CARD' AND is_active = true
    ),
    'installments_due', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.date), '[]'::jsonb)
      FROM (
        SELECT t.id, t.description, t.amount_cents, t.date, t.installment_current, t.installment_total, t.installment_group_id, t.merchant_name, c.name AS category_name, a.name AS account_name
        FROM public.transactions t
        LEFT JOIN public.categories c ON t.category_id = c.id
        LEFT JOIN public.accounts   a ON t.account_id  = a.id
        WHERE t.family_group_id  = p_family_group_id AND t.transaction_type = 'EXPENSE' AND t.date >= v_month_start AND t.date <= v_month_end AND t.installment_total > 1 AND t.is_paid = false
      ) t
    ),
    'recurring_due', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.description), '[]'::jsonb)
      FROM (
        SELECT rt.id, rt.description, rt.amount_cents, rt.transaction_type, rt.next_date, c.name AS category_name, a.name AS account_name
        FROM public.recurring_transactions rt
        LEFT JOIN public.categories c ON rt.category_id = c.id
        LEFT JOIN public.accounts   a ON rt.account_id  = a.id
        WHERE rt.family_group_id = p_family_group_id AND rt.status = 'active' AND rt.next_date >= v_month_start::date AND rt.next_date <= v_month_end::date
      ) r
    ),
    'invoices_due', (
      SELECT COALESCE(jsonb_agg(i ORDER BY i.due_date), '[]'::jsonb)
      FROM (
        SELECT i.id, i.reference_month, i.due_date, i.status, i.amount_cents, a.name AS account_name, a.color_hex
        FROM public.invoices i
        JOIN public.accounts a ON i.account_id = a.id
        WHERE a.family_group_id = p_family_group_id AND i.due_date >= v_month_start::date AND i.due_date <= v_month_end::date AND i.status IN ('OPEN', 'CLOSED')
      ) i
    ),
    'summary', (
      SELECT jsonb_build_object(
        'projected_income_cents', (
          SELECT COALESCE(SUM(amount_cents), 0) FROM public.recurring_transactions
          WHERE family_group_id = p_family_group_id AND transaction_type = 'INCOME' AND status = 'active' AND next_date BETWEEN v_month_start::date AND v_month_end::date
        ),
        'projected_expense_cents', (
          COALESCE((SELECT SUM(amount_cents) FROM public.transactions WHERE family_group_id = p_family_group_id AND transaction_type = 'EXPENSE' AND date BETWEEN v_month_start AND v_month_end AND installment_total > 1 AND t.is_paid = false), 0) +
          COALESCE((SELECT SUM(i.amount_cents) FROM public.invoices i JOIN public.accounts a ON i.account_id = a.id WHERE a.family_group_id = p_family_group_id AND i.due_date BETWEEN v_month_start::date AND v_month_end::date AND i.status IN ('OPEN', 'CLOSED')), 0) +
          COALESCE((SELECT SUM(amount_cents) FROM public.recurring_transactions WHERE family_group_id = p_family_group_id AND transaction_type = 'EXPENSE' AND status = 'active' AND next_date BETWEEN v_month_start::date AND v_month_end::date), 0)
        ),
        'month_start', v_month_start,
        'month_end',   v_month_end
      )
    )
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
