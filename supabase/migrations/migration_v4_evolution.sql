-- ==========================================
-- 🚀 FASE 4: EVOLUTION & WHATSAPP INTEGRATION
-- ==========================================

-- 1. EXTENSÕES E AJUSTES DE TABELAS EXISTENTES
-- ------------------------------------------

-- Transações: Rastreabilidade, Transferências e IA
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS installment_group_id UUID,
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS wa_message_id TEXT;

-- Categorias: Subcategorias
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT FALSE;

-- Perfis: WhatsApp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT UNIQUE;

-- 2. NOVAS TABELAS PARA ECOSSISTEMA N8N/IA
-- ------------------------------------------

-- Sessões de Conversa WhatsApp (Contexto do Agente)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL,
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  last_interaction timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  context_payload jsonb DEFAULT '{}'::jsonb, -- Armazena estado da conversa (ex: "aguardando_confirmacao_gasto")
  CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_sessions_number_key UNIQUE (whatsapp_number)
);

-- Log de Mensagens e Processamento de IA
CREATE TABLE IF NOT EXISTS public.ai_message_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  wa_message_id text,
  direction text CHECK (direction IN ('IN', 'OUT')),
  content text,
  media_url text,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'success', 'failed')),
  processing_time_ms integer,
  extracted_payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_message_log_pkey PRIMARY KEY (id)
);

-- Fila de Eventos Webhook (Idempotência e Retry)
CREATE TABLE IF NOT EXISTS public.n8n_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  raw_payload jsonb NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  retry_count integer DEFAULT 0,
  error_log text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  processed_at timestamp with time zone,
  CONSTRAINT n8n_webhook_events_pkey PRIMARY KEY (id)
);

-- Snapshots Financeiros (Cache para Respostas Rápidas da IA)
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_balance_cents bigint NOT NULL,
  total_committed_cents bigint NOT NULL, -- Soma de faturas + recorrentes do mês
  daily_safe_spend_cents bigint NOT NULL, -- "Quanto posso gastar hoje?"
  payload jsonb NOT NULL, -- Snapshot detalhado
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT financial_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT financial_snapshots_group_date_key UNIQUE (family_group_id, snapshot_date)
);

-- Cache de Conselhos e Análises (Economia de Tokens)
CREATE TABLE IF NOT EXISTS public.spending_advice_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  query_hash text NOT NULL, -- Hash da pergunta do usuário
  advice_text text NOT NULL,
  impact_analysis jsonb,
  valid_until timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spending_advice_cache_pkey PRIMARY KEY (id)
);

-- 3. TRIGGERS DE AUTOMAÇÃO E INTEGRIDADE
-- ------------------------------------------

-- Trigger para Cálculo Automático de Total de Fatura
CREATE OR REPLACE FUNCTION public.update_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN
      UPDATE public.credit_card_invoices
      SET total_amount_cents = (
        SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions
        WHERE invoice_id = OLD.invoice_id
      )
      WHERE id = OLD.invoice_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    UPDATE public.credit_card_invoices
    SET total_amount_cents = (
      SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions
      WHERE invoice_id = NEW.invoice_id
    )
    WHERE id = NEW.invoice_id;
  END IF;

  -- Se mudou de fatura na atualização, atualizar a antiga também
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS NOT NULL AND OLD.invoice_id != NEW.invoice_id THEN
    UPDATE public.credit_card_invoices
    SET total_amount_cents = (
      SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions
      WHERE invoice_id = OLD.invoice_id
    )
    WHERE id = OLD.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_total ON public.transactions;
CREATE TRIGGER trg_invoice_total
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_total();

-- Constraint de Integridade: Só transações de cartão de crédito podem ter invoice_id
-- Nota: Esta constraint requer uma função auxiliar pois CHECK constraints não aceitam subqueries diretamente
CREATE OR REPLACE FUNCTION public.check_invoice_account_type()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type text;
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    IF v_account_type != 'CREDIT_CARD' THEN
      RAISE EXCEPTION 'Apenas contas do tipo CREDIT_CARD podem ter invoice_id associado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invoice_account ON public.transactions;
CREATE TRIGGER trg_check_invoice_account
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_account_type();

-- 4. RPC: GET_FINANCIAL_STATE V3 (ULTRA OPTIMIZED)
-- ------------------------------------------

CREATE OR REPLACE FUNCTION public.get_financial_state_v3(
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
        'month_stats', (
            SELECT json_build_object(
                'income', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'INCOME'), 0),
                'expense', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'EXPENSE'), 0)
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
$$ LANGUAGE plpgsql STABLE;
