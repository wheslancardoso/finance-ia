-- ============================================================
-- 🌌 VESPER FINANCE — MIGRAÇÃO FASE 4 (VERSÃO DEFINITIVA)
-- Dashboard v3 + WhatsApp + n8n + Camada de Inteligência
-- ============================================================
-- Seguro para re-execução (IF NOT EXISTS / OR REPLACE em tudo).
-- Execute inteiro no SQL Editor do Supabase.
-- ============================================================

BEGIN;

-- ============================================================
-- BLOCO 1: EXTENSÕES NAS TABELAS EXISTENTES
-- ============================================================

-- 1.1 PROFILES: vínculo WhatsApp por usuário (não por grupo)
--     Cada pessoa tem seu próprio número. O agente descobre
--     o family_group via family_members.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'pt-BR';

-- 1.2 TRANSACTIONS: rastreabilidade, transferências, IA
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS family_group_id       UUID REFERENCES public.family_groups(id),
  ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_group_id  UUID,
  ADD COLUMN IF NOT EXISTS source_metadata       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS wa_message_id         TEXT;

-- Popular family_group_id para transações existentes (executa uma vez, seguro re-executar)
UPDATE public.transactions t
SET    family_group_id = a.family_group_id
FROM   public.accounts a
WHERE  a.id = t.account_id
  AND  t.family_group_id IS NULL;

-- Índice de deduplicação: n8n verifica wa_message_id antes de inserir
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_wa_message_id
  ON public.transactions (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- Índice para agrupar parcelas da mesma compra
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group
  ON public.transactions (installment_group_id)
  WHERE installment_group_id IS NOT NULL;

-- Índice composto para queries do dashboard e da IA
CREATE INDEX IF NOT EXISTS idx_transactions_family_month
  ON public.transactions (family_group_id, date DESC);

-- 1.3 CATEGORIES: subcategorias e defaults do sistema
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_system_default   BOOLEAN DEFAULT FALSE;

-- ============================================================
-- BLOCO 2: NOVAS TABELAS — ECOSSISTEMA N8N / IA
-- ============================================================

-- 2.1 Sessões de conversa WhatsApp
--     Mantém o ESTADO entre mensagens (contexto multi-turn).
--     Essencial para o "Guardião de Compras" que aguarda confirmação.
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_group_id     UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  wa_id               TEXT        NOT NULL, -- Telefone formatado: +5562999999999
  context_state       JSONB       NOT NULL DEFAULT '{"step": "idle"}'::jsonb,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_sessions_pkey   PRIMARY KEY (id),
  CONSTRAINT whatsapp_sessions_wa_key UNIQUE (wa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_family
  ON public.whatsapp_sessions (family_group_id);

-- 2.2 Fila de eventos webhook (idempotência e retry)
CREATE TABLE IF NOT EXISTS public.n8n_webhook_events (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key  TEXT        NOT NULL, -- wa_message_id ou hash do payload
  event_type       TEXT        NOT NULL, -- 'whatsapp_text', 'whatsapp_audio', 'whatsapp_image'
  raw_payload      JSONB       NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  retry_count      INTEGER     NOT NULL DEFAULT 0,
  error_log        TEXT,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at     TIMESTAMPTZ,
  CONSTRAINT n8n_webhook_events_pkey     PRIMARY KEY (id),
  CONSTRAINT n8n_webhook_events_idem_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_n8n_events_pending
  ON public.n8n_webhook_events (status, received_at)
  WHERE status IN ('pending', 'failed');

-- 2.3 Log de mensagens e processamento de IA
CREATE TABLE IF NOT EXISTS public.ai_message_log (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  family_group_id       UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  profile_id            UUID        REFERENCES public.profiles(id),
  wa_message_id         TEXT,
  sender                TEXT        NOT NULL CHECK (sender IN ('user', 'ai', 'system')),
  content_type          TEXT        NOT NULL DEFAULT 'text'
                                    CHECK (content_type IN ('text', 'audio', 'image', 'document')),
  raw_content           TEXT,       -- Texto digitado ou transcrição do Whisper
  media_url             TEXT,       -- URL temporária do arquivo de mídia
  processing_status     TEXT        NOT NULL DEFAULT 'success'
                                    CHECK (processing_status IN ('pending', 'processing', 'success', 'failed', 'duplicate')),
  processing_time_ms    INTEGER,
  tokens_used           INTEGER     DEFAULT 0,
  extracted_payload     JSONB       DEFAULT '{}'::jsonb, -- JSON retornado pelo GPT-4o
  linked_transaction_id UUID        REFERENCES public.transactions(id) ON DELETE SET NULL,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_message_log_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ai_message_log_family
  ON public.ai_message_log (family_group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_log_wa_id
  ON public.ai_message_log (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_message_log_wa_id_unique
  ON public.ai_message_log (wa_message_id)
  WHERE wa_message_id IS NOT NULL AND sender = 'user';

-- 2.4 Snapshots financeiros diários
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id                      UUID   NOT NULL DEFAULT gen_random_uuid(),
  family_group_id         UUID   NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  snapshot_date           DATE   NOT NULL DEFAULT CURRENT_DATE,
  total_liquid_cents      BIGINT NOT NULL DEFAULT 0, -- Saldo de contas não-cartão
  total_credit_debt_cents BIGINT NOT NULL DEFAULT 0, -- Faturas abertas de cartão
  net_worth_cents         BIGINT NOT NULL DEFAULT 0, -- liquid - credit_debt
  monthly_income_cents    BIGINT NOT NULL DEFAULT 0, -- Renda prevista (recorrentes INCOME)
  monthly_committed_cents BIGINT NOT NULL DEFAULT 0, -- Faturas + recorrentes EXPENSE
  free_cash_cents         BIGINT NOT NULL DEFAULT 0, -- income - committed (Sobra Livre)
  daily_safe_spend_cents  BIGINT NOT NULL DEFAULT 0, -- free_cash / dias restantes no mês
  payload                 JSONB  NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_snapshots_pkey       PRIMARY KEY (id),
  CONSTRAINT financial_snapshots_group_date UNIQUE (family_group_id, snapshot_date)
);

-- 2.5 Cache de conselhos da IA
CREATE TABLE IF NOT EXISTS public.spending_advice_cache (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  family_group_id UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  context_hash    TEXT        NOT NULL, -- MD5(pergunta_normalizada + snapshot_date)
  advice_text     TEXT        NOT NULL,
  impact_analysis JSONB,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT spending_advice_cache_pkey     PRIMARY KEY (id),
  CONSTRAINT spending_advice_cache_hash_key UNIQUE (family_group_id, context_hash)
);

-- ============================================================
-- BLOCO 3: TRIGGERS DE AUTOMAÇÃO E INTEGRIDADE
-- ============================================================

-- 3.1 Total de fatura (database-driven)
CREATE OR REPLACE FUNCTION public.fn_sync_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  -- DELETE: só existe OLD, não NEW
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN
      UPDATE public.credit_card_invoices
         SET total_amount_cents = COALESCE((
               SELECT SUM(amount_cents) FROM public.transactions
               WHERE invoice_id = OLD.invoice_id
             ), 0)
       WHERE id = OLD.invoice_id;
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT ou UPDATE: atualiza fatura nova
  IF NEW.invoice_id IS NOT NULL THEN
    UPDATE public.credit_card_invoices
       SET total_amount_cents = COALESCE((
             SELECT SUM(amount_cents) FROM public.transactions
             WHERE invoice_id = NEW.invoice_id
           ), 0)
     WHERE id = NEW.invoice_id;
  END IF;

  -- UPDATE: se mudou de fatura, atualiza a antiga também
  IF TG_OP = 'UPDATE'
     AND OLD.invoice_id IS NOT NULL
     AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    UPDATE public.credit_card_invoices
       SET total_amount_cents = COALESCE((
             SELECT SUM(amount_cents) FROM public.transactions
             WHERE invoice_id = OLD.invoice_id
           ), 0)
     WHERE id = OLD.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_invoice_total ON public.transactions;
CREATE TRIGGER tr_sync_invoice_total
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_invoice_total();

-- 3.2 Integridade invoice_id / CREDIT_CARD
CREATE OR REPLACE FUNCTION public.fn_check_invoice_account_type()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type TEXT;
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT type INTO v_account_type
      FROM public.accounts
     WHERE id = NEW.account_id;

    IF v_account_type IS DISTINCT FROM 'CREDIT_CARD' THEN
      RAISE EXCEPTION
        'invoice_id só pode ser associado a transações CREDIT_CARD. Conta atual: %',
        v_account_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_invoice_account ON public.transactions;
CREATE TRIGGER tr_check_invoice_account
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_invoice_account_type();

-- 3.3 Invalidar cache quando uma transação é registrada
CREATE OR REPLACE FUNCTION public.fn_invalidate_advice_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_family_group_id UUID;
BEGIN
  SELECT family_group_id INTO v_family_group_id
    FROM public.accounts
   WHERE id = COALESCE(NEW.account_id, OLD.account_id);

  IF v_family_group_id IS NOT NULL THEN
    UPDATE public.spending_advice_cache
       SET expires_at = NOW()
     WHERE family_group_id = v_family_group_id
       AND expires_at > NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_invalidate_advice_cache ON public.transactions;
CREATE TRIGGER tr_invalidate_advice_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_invalidate_advice_cache();

-- ============================================================
-- BLOCO 4: RPC get_financial_state_v3
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_financial_state_v3(
  p_family_group_id UUID,
  p_target_month    TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result      JSONB;
  v_month_start TIMESTAMPTZ := date_trunc('month', COALESCE(p_target_month, NOW()));
  v_month_end   TIMESTAMPTZ := v_month_start + interval '1 month' - interval '1 second';
BEGIN
  SELECT jsonb_build_object(
    'family_group', (
      SELECT jsonb_build_object(
        'id',                        id,
        'name',                      name,
        'monthly_income_cents',      COALESCE(monthly_income_cents, 0),
        'accumulated_balance_cents', COALESCE(accumulated_balance_cents, 0)
      )
      FROM public.family_groups
      WHERE id = p_family_group_id
    ),
    'accounts', (
      SELECT COALESCE(jsonb_agg(a ORDER BY a.name), '[]'::jsonb)
      FROM (
        SELECT id, name, type, balance_cents, credit_limit_cents,
               color_hex, is_active, closing_day, due_day, currency_code
        FROM public.accounts
        WHERE family_group_id = p_family_group_id AND is_active = true
      ) a
    ),
    'invoices', (
      SELECT COALESCE(jsonb_agg(i), '[]'::jsonb)
      FROM (
        SELECT i.*
        FROM public.credit_card_invoices i
        JOIN public.accounts a ON i.account_id = a.id
        WHERE a.family_group_id = p_family_group_id
          AND i.status IN ('OPEN', 'CLOSED')
      ) i
    ),
    'goals', (
      SELECT COALESCE(jsonb_agg(g ORDER BY g.deadline ASC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT * FROM public.goals
        WHERE family_group_id = p_family_group_id AND status = 'active'
      ) g
    ),
    'recurring_transactions', (
      SELECT COALESCE(jsonb_agg(rt ORDER BY rt.description), '[]'::jsonb)
      FROM (
        SELECT rt.*,
               row_to_json(c)   AS category,
               row_to_json(acc) AS account
        FROM public.recurring_transactions rt
        LEFT JOIN public.categories c   ON rt.category_id = c.id
        LEFT JOIN public.accounts   acc ON rt.account_id  = acc.id
        WHERE rt.family_group_id = p_family_group_id
          AND rt.status = 'active'
      ) rt
    ),
    'budgets', (
      SELECT COALESCE(jsonb_agg(b), '[]'::jsonb)
      FROM public.budgets b
      WHERE b.family_group_id = p_family_group_id
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(c ORDER BY c.name), '[]'::jsonb)
      FROM (
        SELECT id, name, type, icon_name, color_hex, parent_category_id, is_system_default
        FROM public.categories
        WHERE family_group_id = p_family_group_id OR is_system_default = true
      ) c
    ),
    'recent_transactions', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.date DESC, t.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT t.*,
               c.name      AS category_name,
               c.icon_name AS category_icon,
               c.color_hex AS category_color,
               acc.name    AS account_name,
               acc.type    AS account_type,
               acc.color_hex AS account_color
        FROM public.transactions t
        LEFT JOIN public.categories c   ON t.category_id = c.id
        LEFT JOIN public.accounts   acc ON t.account_id  = acc.id
        WHERE t.family_group_id = p_family_group_id
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 50
      ) t
    ),
    'month_transactions', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.date DESC), '[]'::jsonb)
      FROM (
        SELECT t.*,
               c.name      AS category_name,
               c.icon_name AS category_icon,
               acc.name    AS account_name,
               acc.type    AS account_type
        FROM public.transactions t
        LEFT JOIN public.categories c   ON t.category_id = c.id
        LEFT JOIN public.accounts   acc ON t.account_id  = acc.id
        WHERE t.family_group_id = p_family_group_id
          AND t.date >= v_month_start
          AND t.date <= v_month_end
      ) t
    ),
    'month_stats', (
      SELECT jsonb_build_object(
        'income',         COALESCE(SUM(t.amount_cents) FILTER (WHERE t.transaction_type = 'INCOME'),  0),
        'expense',        COALESCE(SUM(t.amount_cents) FILTER (WHERE t.transaction_type = 'EXPENSE'), 0),
        'debit_expense',  COALESCE(SUM(t.amount_cents) FILTER (
                            WHERE t.transaction_type = 'EXPENSE' AND acc.type != 'CREDIT_CARD'
                          ), 0),
        'credit_expense', COALESCE(SUM(t.amount_cents) FILTER (
                            WHERE t.transaction_type = 'EXPENSE' AND acc.type = 'CREDIT_CARD'
                          ), 0),
        'month_start',    v_month_start,
        'month_end',      v_month_end
      )
      FROM public.transactions t
      JOIN public.accounts acc ON t.account_id = acc.id
      WHERE t.family_group_id = p_family_group_id
        AND t.date >= v_month_start
        AND t.date <= v_month_end
    ),
    'daily_snapshot', (
      SELECT row_to_json(s)
      FROM public.financial_snapshots s
      WHERE s.family_group_id = p_family_group_id
        AND s.snapshot_date = CURRENT_DATE
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- BLOCO 5: RPC get_whatsapp_context
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_whatsapp_context(p_whatsapp_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_profile_id      UUID;
  v_family_group_id UUID;
  v_user_name       TEXT;
BEGIN
  SELECT p.id, p.full_name
    INTO v_profile_id, v_user_name
    FROM public.profiles p
   WHERE p.whatsapp_number = p_whatsapp_number
   LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'found',   false,
      'message', 'Número não vinculado. Acesse o Vesper e vincule seu WhatsApp em Configurações.'
    );
  END IF;

  SELECT family_group_id
    INTO v_family_group_id
    FROM public.family_members
   WHERE user_id = v_profile_id
   LIMIT 1;

  RETURN jsonb_build_object(
    'found',            true,
    'profile_id',       v_profile_id,
    'user_name',        v_user_name,
    'family_group_id',  v_family_group_id,
    'session', (
      SELECT row_to_json(s)
      FROM public.whatsapp_sessions s
      WHERE s.wa_id = p_whatsapp_number
      LIMIT 1
    ),
    'snapshot', (
      SELECT row_to_json(fs)
      FROM public.financial_snapshots fs
      WHERE fs.family_group_id = v_family_group_id
        AND fs.snapshot_date = CURRENT_DATE
      LIMIT 1
    ),
    'accounts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',   a.id,
        'name', a.name,
        'type', a.type
      )), '[]'::jsonb)
      FROM public.accounts a
      WHERE a.family_group_id = v_family_group_id
        AND a.is_active = true
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',   c.id,
        'name', c.name,
        'type', c.type
      )), '[]'::jsonb)
      FROM public.categories c
      WHERE c.family_group_id = v_family_group_id
         OR c.is_system_default = true
    )
  );
END;
$$;

-- ============================================================
-- BLOCO 6: RPC calculate_daily_snapshot
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_daily_snapshot(p_family_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_liquid         BIGINT;
  v_credit_debt    BIGINT;
  v_income         BIGINT;
  v_committed      BIGINT;
  v_free_cash      BIGINT;
  v_days_remaining INTEGER;
  v_daily_safe     BIGINT;
  v_month_end      DATE := (date_trunc('month', NOW()) + interval '1 month - 1 day')::date;
BEGIN
  SELECT COALESCE(SUM(balance_cents), 0) INTO v_liquid
    FROM public.accounts
   WHERE family_group_id = p_family_group_id
     AND type != 'CREDIT_CARD'
     AND is_active = true;

  SELECT COALESCE(SUM(i.total_amount_cents), 0) INTO v_credit_debt
    FROM public.credit_card_invoices i
    JOIN public.accounts a ON i.account_id = a.id
   WHERE a.family_group_id = p_family_group_id
     AND i.status IN ('OPEN', 'CLOSED');

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_income
    FROM public.recurring_transactions
   WHERE family_group_id = p_family_group_id
     AND transaction_type = 'INCOME'
     AND status = 'active';

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_committed
    FROM public.recurring_transactions
   WHERE family_group_id = p_family_group_id
     AND transaction_type = 'EXPENSE'
     AND status = 'active';

  v_committed      := v_committed + v_credit_debt;
  v_free_cash      := GREATEST(v_income - v_committed, 0);
  v_days_remaining := GREATEST((v_month_end - CURRENT_DATE)::integer, 1);
  v_daily_safe     := v_free_cash / v_days_remaining;

  INSERT INTO public.financial_snapshots (
    family_group_id, snapshot_date,
    total_liquid_cents, total_credit_debt_cents, net_worth_cents,
    monthly_income_cents, monthly_committed_cents,
    free_cash_cents, daily_safe_spend_cents,
    payload
  ) VALUES (
    p_family_group_id, CURRENT_DATE,
    v_liquid, v_credit_debt, (v_liquid - v_credit_debt),
    v_income, v_committed,
    v_free_cash, v_daily_safe,
    jsonb_build_object(
      'liquid',         v_liquid,
      'credit_debt',    v_credit_debt,
      'net_worth',      v_liquid - v_credit_debt,
      'income',         v_income,
      'committed',      v_committed,
      'free_cash',      v_free_cash,
      'daily_safe',     v_daily_safe,
      'days_remaining', v_days_remaining,
      'calculated_at',  NOW()
    )
  )
  ON CONFLICT (family_group_id, snapshot_date) DO UPDATE SET
    total_liquid_cents      = EXCLUDED.total_liquid_cents,
    total_credit_debt_cents = EXCLUDED.total_credit_debt_cents,
    net_worth_cents         = EXCLUDED.net_worth_cents,
    monthly_income_cents    = EXCLUDED.monthly_income_cents,
    monthly_committed_cents = EXCLUDED.monthly_committed_cents,
    free_cash_cents         = EXCLUDED.free_cash_cents,
    daily_safe_spend_cents  = EXCLUDED.daily_safe_spend_cents,
    payload                 = EXCLUDED.payload,
    created_at              = NOW();

  RETURN jsonb_build_object(
    'success',       true,
    'snapshot_date', CURRENT_DATE,
    'daily_safe',    v_daily_safe,
    'free_cash',     v_free_cash,
    'net_worth',     v_liquid - v_credit_debt
  );
END;
$$;

-- ============================================================
-- BLOCO 7: SEGURANÇA — ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.whatsapp_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_webhook_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_advice_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_whatsapp_session" ON public.whatsapp_sessions;
CREATE POLICY "own_whatsapp_session" ON public.whatsapp_sessions
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "family_members_read_ai_logs" ON public.ai_message_log;
CREATE POLICY "family_members_read_ai_logs" ON public.ai_message_log
  FOR SELECT USING (
    family_group_id IN (
      SELECT family_group_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family_members_read_snapshots" ON public.financial_snapshots;
CREATE POLICY "family_members_read_snapshots" ON public.financial_snapshots
  FOR SELECT USING (
    family_group_id IN (
      SELECT family_group_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family_members_read_advice_cache" ON public.spending_advice_cache;
CREATE POLICY "family_members_read_advice_cache" ON public.spending_advice_cache
  FOR SELECT USING (
    family_group_id IN (
      SELECT family_group_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

COMMIT;
