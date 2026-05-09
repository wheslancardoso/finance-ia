-- ============================================================
-- 🌌 VESPER FINANCE — MIGRAÇÃO FASE 5.1 (DEFINITIVA)
-- Gaps Finais + Features de Alta Prioridade
-- ============================================================
-- Depende das Fases 4 e 5 já executadas.
-- Seguro para re-execução (IF NOT EXISTS / OR REPLACE em tudo).
-- Execute inteiro no SQL Editor do Supabase.
-- ============================================================

BEGIN;

-- ============================================================
-- BLOCO 1: EXTENSÕES EM TRANSACTIONS
-- ============================================================
-- 7 colunas novas. Nenhuma quebra dados existentes.
-- Todas com DEFAULT seguro para não afetar linhas atuais.

-- 1.1 Offline / local-first
--     O Dexie.js (IndexedDB) cria registros localmente com
--     sync_status = 'pending'. Quando a conexão volta, o app
--     faz upsert no Supabase e marca como 'synced'.
--     synced_at = NULL significa "ainda não sincronizado".
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS synced_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_status  TEXT        DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'pending', 'conflict'));

-- Popular sync_status para transações existentes
-- (todas que já estão no banco são consideradas sincronizadas)
UPDATE public.transactions
   SET sync_status = 'synced',
       synced_at   = created_at
 WHERE sync_status IS NULL OR sync_status = 'synced';

-- 1.2 Contexto rico por transação
--     notes: observação livre do usuário ("almoço de negócios",
--            "presente pro João", "compra parcelada do iPhone")
--     receipt_url: link do arquivo no Supabase Storage
--            (foto do recibo enviada via WhatsApp ou upload manual)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS notes       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT NULL;

-- 1.3 Tags livres para busca semântica
--     Array de texto permite filtros como: WHERE 'viagem' = ANY(tags)
--     Exemplos: ['viagem', 'trabalho'], ['saude', 'reembolsavel']
--     O frontend e o n8n podem sugerir tags baseadas na categoria/merchant.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Índice GIN para busca eficiente em arrays de tags
CREATE INDEX IF NOT EXISTS idx_transactions_tags
  ON public.transactions USING GIN (tags)
  WHERE tags != '{}';

-- ============================================================
-- BLOCO 2: EXTENSÕES EM GOALS (Conselheiro Financeiro)
-- ============================================================
-- Permite ao sistema responder: "quando vou conseguir comprar X?"
-- e "quanto devo aportar por mês para chegar lá em Y meses?"

ALTER TABLE public.goals
  -- Quanto o usuário aporta por mês nesta meta (manual ou calculado)
  ADD COLUMN IF NOT EXISTS monthly_contribution_cents BIGINT DEFAULT 0,

  -- Data projetada para atingir a meta, calculada como:
  --   meses_restantes = CEIL((target - current) / monthly_contribution)
  --   projected_date  = TODAY + meses_restantes
  -- Recalculada pelo frontend ou por RPC após cada aporte.
  ADD COLUMN IF NOT EXISTS projected_completion_date DATE DEFAULT NULL,

  -- Prioridade de alocação automática (1 = mais urgente)
  -- Usado pelo Simulador de Compras para sugerir redistribuição
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5
    CHECK (priority BETWEEN 1 AND 10),

  -- Tipo da meta para UI diferenciada e lógica de alocação
  ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT 'custom'
    CHECK (goal_type IN (
      'emergency_fund',  -- Reserva de emergência (máxima prioridade)
      'debt_payoff',     -- Quitação de dívida
      'purchase',        -- Compra planejada (carro, celular, viagem)
      'investment',      -- Investimento de longo prazo
      'custom'           -- Livre
    ));

-- ============================================================
-- BLOCO 3: TABELA exchange_rates (Multimoeda Real)
-- ============================================================
-- Armazena taxas de câmbio buscadas periodicamente pelo n8n
-- (via cron diário chamando uma API de câmbio gratuita).
-- O frontend usa para converter saldos em moeda estrangeira
-- para o BRL na Sobra Livre e no patrimônio líquido.

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  from_currency TEXT        NOT NULL, -- ex: 'USD', 'EUR', 'GBP'
  to_currency   TEXT        NOT NULL DEFAULT 'BRL',
  rate          NUMERIC(18,6) NOT NULL, -- ex: 5.721300 (1 USD = R$5,7213)
  source        TEXT        DEFAULT 'manual', -- 'manual', 'awesomeapi', 'n8n_cron'
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchange_rates_pkey PRIMARY KEY (id),
  CONSTRAINT exchange_rates_unique UNIQUE (from_currency, to_currency)
  -- ON CONFLICT (from_currency, to_currency) DO UPDATE SET rate, fetched_at
  -- Usar upsert via INSERT ... ON CONFLICT no n8n
);

-- Índice para busca rápida do par de moedas
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair
  ON public.exchange_rates (from_currency, to_currency);

-- Taxas iniciais (ajuste conforme necessário)
-- Usando ON CONFLICT para ser idempotente
INSERT INTO public.exchange_rates (from_currency, to_currency, rate, source)
VALUES
  ('USD', 'BRL', 5.7500, 'manual'),
  ('EUR', 'BRL', 6.2000, 'manual'),
  ('GBP', 'BRL', 7.3000, 'manual'),
  ('ARS', 'BRL', 0.0057, 'manual'),
  ('BTC', 'BRL', 580000.00, 'manual')
ON CONFLICT (from_currency, to_currency)
DO UPDATE SET
  rate       = EXCLUDED.rate,
  fetched_at = NOW(),
  source     = EXCLUDED.source;

-- ============================================================
-- BLOCO 4: TABELA scheduled_alerts (Notificações Agendadas)
-- ============================================================
-- Persiste alertas que o n8n vai disparar no momento certo.
-- O cron do n8n roda a cada hora e busca:
--   WHERE status = 'pending' AND trigger_at <= NOW()
--
-- Exemplos de uso:
--   - "Avisar 3 dias antes do vencimento da fatura do Nubank"
--   - "Lembrar de aportar na meta Viagem toda sexta às 9h"
--   - "Alertar se o saldo da conta cair abaixo de R$500"

CREATE TABLE IF NOT EXISTS public.scheduled_alerts (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  family_group_id UUID        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  profile_id      UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Quando disparar
  trigger_at      TIMESTAMPTZ NOT NULL,

  -- Tipo define o template de mensagem e a lógica de recorrência
  alert_type      TEXT        NOT NULL CHECK (alert_type IN (
    'invoice_due',        -- Fatura vencendo
    'goal_contribution',  -- Lembrete de aporte em meta
    'low_balance',        -- Saldo abaixo de threshold
    'budget_warning',     -- Orçamento quase estourado (>80%)
    'budget_exceeded',    -- Orçamento estourado
    'recurring_due',      -- Recorrente vencendo
    'custom'              -- Livre, criado pelo usuário ou IA
  )),

  -- Canal de entrega
  channel         TEXT        NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'push', 'email')),

  -- Dados do alerta (flexível por tipo)
  payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Exemplos de payload:
  --   invoice_due:       {"invoice_id": "uuid", "account_name": "Nubank", "amount_cents": 150000}
  --   low_balance:       {"account_id": "uuid", "threshold_cents": 50000}
  --   goal_contribution: {"goal_id": "uuid", "goal_name": "Viagem", "suggested_cents": 30000}

  -- Recorrência
  is_recurring    BOOLEAN     NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT        DEFAULT NULL, -- cron expression: '0 9 * * 5' = toda sexta às 9h

  -- Status do ciclo de vida
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),

  sent_at         TIMESTAMPTZ DEFAULT NULL,
  error_message   TEXT        DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT scheduled_alerts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_alerts_pending
  ON public.scheduled_alerts (trigger_at, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_alerts_family
  ON public.scheduled_alerts (family_group_id, status);

-- ============================================================
-- BLOCO 5: COLUNA score EM financial_snapshots
-- ============================================================
-- Score de 0 a 100 calculado diariamente junto com o snapshot.
-- Algoritmo ponderado (ajustável):
--   30% → índice de poupança (free_cash / income)
--   25% → razão dívida/renda (credit_debt / income) — inverso
--   25% → progresso de metas (média do % atingido)
--   20% → dias consecutivos com sobra livre positiva

ALTER TABLE public.financial_snapshots
  ADD COLUMN IF NOT EXISTS financial_health_score INTEGER DEFAULT NULL
    CHECK (financial_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT NULL;
  -- Exemplo de score_breakdown:
  -- {
  --   "savings_rate": 72,        -- free_cash/income em %
  --   "debt_ratio": 15,          -- credit_debt/income em %
  --   "goals_progress": 45,      -- média de progresso das metas
  --   "positive_days_streak": 12 -- dias seguidos com sobra > 0
  -- }

-- ============================================================
-- BLOCO 6: RPC calculate_goal_projection
-- ============================================================
-- Calcula e persiste a data projetada de conclusão de uma meta
-- com base na contribuição mensal atual e no saldo restante.
-- Chamada pelo frontend após cada aporte ou mudança de contribuição.

CREATE OR REPLACE FUNCTION public.calculate_goal_projection(
  p_goal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target      BIGINT;
  v_current     BIGINT;
  v_monthly     BIGINT;
  v_remaining   BIGINT;
  v_months      INTEGER;
  v_proj_date   DATE;
BEGIN
  SELECT target_amount_cents, current_amount_cents, monthly_contribution_cents
    INTO v_target, v_current, v_monthly
    FROM public.goals
   WHERE id = p_goal_id;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Meta nao encontrada');
  END IF;

  v_remaining := GREATEST(v_target - v_current, 0);

  -- Sem meta atingida ou sem contribuição
  IF v_remaining = 0 THEN
    UPDATE public.goals
       SET projected_completion_date = CURRENT_DATE,
           status = 'completed'
     WHERE id = p_goal_id;
    RETURN jsonb_build_object('success', true, 'completed', true, 'projected_date', CURRENT_DATE);
  END IF;

  IF v_monthly IS NULL OR v_monthly <= 0 THEN
    -- Sem contribuição definida: não há projeção possível
    UPDATE public.goals
       SET projected_completion_date = NULL
     WHERE id = p_goal_id;
    RETURN jsonb_build_object('success', true, 'projected_date', null,
      'message', 'Defina uma contribuição mensal para calcular a projeção');
  END IF;

  -- Meses necessários (arredondado para cima)
  v_months := CEIL(v_remaining::NUMERIC / v_monthly::NUMERIC)::INTEGER;

  -- Data projetada
  v_proj_date := (CURRENT_DATE + (v_months * interval '1 month'))::date;

  UPDATE public.goals
     SET projected_completion_date = v_proj_date
   WHERE id = p_goal_id;

  RETURN jsonb_build_object(
    'success',          true,
    'remaining_cents',  v_remaining,
    'monthly_cents',    v_monthly,
    'months_needed',    v_months,
    'projected_date',   v_proj_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_goal_projection TO authenticated;

-- ============================================================
-- BLOCO 7: RPC simulate_purchase_impact
-- ============================================================
-- O Simulador de Compras (Anti-Emoção).
-- Dado um valor de compra, calcula o impacto em:
--   - Sobra livre do mês atual
--   - Projeção de cada meta ativa
--   - Data em que a compra seria "segura" (sem comprometer metas)
--
-- Retorna um conselho estruturado para o frontend renderizar
-- ou para o agente WhatsApp responder em linguagem natural.

CREATE OR REPLACE FUNCTION public.simulate_purchase_impact(
  p_family_group_id UUID,
  p_purchase_cents  BIGINT,
  p_purchase_date   DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_snapshot      RECORD;
  v_goals_impact  JSONB;
  v_safe_date     DATE;
  v_months_to_safe INTEGER;
BEGIN
  -- Buscar snapshot mais recente
  SELECT * INTO v_snapshot
    FROM public.financial_snapshots
   WHERE family_group_id = p_family_group_id
   ORDER BY snapshot_date DESC
   LIMIT 1;

  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rode calculate_daily_snapshot primeiro'
    );
  END IF;

  -- Impacto nas metas ativas
  SELECT COALESCE(jsonb_agg(g_impact ORDER BY g_impact->>'priority'), '[]'::jsonb)
    INTO v_goals_impact
  FROM (
    SELECT jsonb_build_object(
      'goal_id',          g.id,
      'goal_name',        g.name,
      'goal_type',        g.goal_type,
      'priority',         g.priority,
      'current_cents',    g.current_amount_cents,
      'target_cents',     g.target_amount_cents,
      'monthly_cents',    COALESCE(g.monthly_contribution_cents, 0),
      'projected_date',   g.projected_completion_date,
      -- Se a compra fosse abatida da meta, quanto atrasaria?
      'months_delayed',   CASE
        WHEN COALESCE(g.monthly_contribution_cents, 0) > 0
        THEN CEIL(p_purchase_cents::NUMERIC / g.monthly_contribution_cents::NUMERIC)::INTEGER
        ELSE NULL
      END
    ) AS g_impact
    FROM public.goals g
    WHERE g.family_group_id = p_family_group_id
      AND g.status = 'active'
  ) sub;

  -- Calcular quando a compra seria "segura":
  -- Meses até ter a sobra acumulada para cobrir a compra
  -- sem tocar nas metas (usando free_cash mensal)
  IF v_snapshot.free_cash_cents > 0 THEN
    v_months_to_safe := GREATEST(
      CEIL(p_purchase_cents::NUMERIC / v_snapshot.free_cash_cents::NUMERIC)::INTEGER,
      0
    );
    v_safe_date := (p_purchase_date + (v_months_to_safe * interval '1 month'))::date;
  ELSE
    v_months_to_safe := NULL;
    v_safe_date      := NULL;
  END IF;

  RETURN jsonb_build_object(
    'success',             true,
    'purchase_cents',      p_purchase_cents,

    -- Impacto imediato na sobra livre
    'free_cash_before',    v_snapshot.free_cash_cents,
    'free_cash_after',     v_snapshot.free_cash_cents - p_purchase_cents,
    'free_cash_pct_used',  ROUND(
      (p_purchase_cents::NUMERIC / NULLIF(v_snapshot.free_cash_cents, 0)::NUMERIC) * 100, 1
    ),

    -- Veredito
    'is_safe',             (v_snapshot.free_cash_cents - p_purchase_cents) >= 0,
    'safe_purchase_date',  v_safe_date,
    'months_to_safe',      v_months_to_safe,

    -- Impacto nas metas
    'goals_impact',        v_goals_impact,

    -- Contexto do snapshot usado
    'snapshot_date',       v_snapshot.snapshot_date,
    'net_worth_cents',     v_snapshot.net_worth_cents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.simulate_purchase_impact TO authenticated;

-- ============================================================
-- BLOCO 8: RPC upsert_exchange_rate
-- ============================================================
-- Chamada pelo n8n (cron diário) para atualizar as taxas.
-- Usa ON CONFLICT para ser idempotente.

CREATE OR REPLACE FUNCTION public.upsert_exchange_rate(
  p_from_currency TEXT,
  p_to_currency   TEXT,
  p_rate          NUMERIC,
  p_source        TEXT DEFAULT 'n8n_cron'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.exchange_rates (from_currency, to_currency, rate, source, fetched_at)
  VALUES (p_from_currency, p_to_currency, p_rate, p_source, NOW())
  ON CONFLICT (from_currency, to_currency)
  DO UPDATE SET
    rate       = EXCLUDED.rate,
    source     = EXCLUDED.source,
    fetched_at = NOW();

  RETURN jsonb_build_object(
    'success',        true,
    'from_currency',  p_from_currency,
    'to_currency',    p_to_currency,
    'rate',           p_rate,
    'fetched_at',     NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_exchange_rate TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_exchange_rate TO service_role;

-- ============================================================
-- BLOCO 9: RPC convert_amount
-- ============================================================
-- Converte um valor entre moedas usando a taxa mais recente.
-- Usada pelo frontend para exibir saldos em moeda local (BRL)
-- quando o usuário tem contas em USD, EUR etc.

CREATE OR REPLACE FUNCTION public.convert_amount(
  p_amount        BIGINT,
  p_from_currency TEXT,
  p_to_currency   TEXT DEFAULT 'BRL'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN jsonb_build_object(
      'success',         true,
      'original_cents',  p_amount,
      'converted_cents', p_amount,
      'rate',            1.0,
      'note',            'Mesma moeda, sem conversao'
    );
  END IF;

  SELECT rate INTO v_rate
    FROM public.exchange_rates
   WHERE from_currency = p_from_currency
     AND to_currency   = p_to_currency;

  IF v_rate IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Taxa nao encontrada para ' || p_from_currency || ' -> ' || p_to_currency
    );
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'original_cents',  p_amount,
    'converted_cents', ROUND(p_amount * v_rate)::BIGINT,
    'rate',            v_rate,
    'from_currency',   p_from_currency,
    'to_currency',     p_to_currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_amount TO authenticated;

-- ============================================================
-- BLOCO 10: TRIGGER — auto-criar alertas de fatura
-- ============================================================
-- Quando uma fatura muda para status CLOSED, cria automaticamente
-- um scheduled_alert para avisar 3 dias antes do vencimento.
-- O n8n pega esse alerta no cron horário e dispara no WhatsApp.

CREATE OR REPLACE FUNCTION public.fn_auto_create_invoice_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_family_group_id UUID;
  v_trigger_date    TIMESTAMPTZ;
BEGIN
  -- Só age quando fatura fecha (transição para CLOSED)
  IF NEW.status = 'CLOSED' AND (OLD.status IS DISTINCT FROM 'CLOSED') THEN

    SELECT a.family_group_id INTO v_family_group_id
      FROM public.accounts a
     WHERE a.id = NEW.account_id;

    -- Dispara 3 dias antes do vencimento às 09:00
    v_trigger_date := (NEW.due_date - interval '3 days')::timestamptz
                      + interval '9 hours';

    -- Só cria se o trigger ainda não passou
    IF v_trigger_date > NOW() THEN
      INSERT INTO public.scheduled_alerts (
        family_group_id, trigger_at, alert_type, channel, payload
      ) VALUES (
        v_family_group_id,
        v_trigger_date,
        'invoice_due',
        'whatsapp',
        jsonb_build_object(
          'invoice_id',    NEW.id,
          'reference_month', NEW.reference_month,
          'due_date',      NEW.due_date,
          'amount_cents',  NEW.amount_cents
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_create_invoice_alert ON public.credit_card_invoices;
CREATE TRIGGER tr_auto_create_invoice_alert
  AFTER UPDATE OF status ON public.credit_card_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_invoice_alert();

-- ============================================================
-- BLOCO 11: ÍNDICES DE PERFORMANCE (novos)
-- ============================================================

-- Busca por notas/contexto (quando o usuário quer encontrar transações)
CREATE INDEX IF NOT EXISTS idx_transactions_notes
  ON public.transactions USING GIN (to_tsvector('portuguese', COALESCE(notes, '')))
  WHERE notes IS NOT NULL;

-- Pendentes de sync (app mobile verifica isso ao reconectar)
CREATE INDEX IF NOT EXISTS idx_transactions_sync_pending
  ON public.transactions (family_group_id, sync_status)
  WHERE sync_status = 'pending';

-- Metas por tipo e prioridade (Simulador de Compras)
CREATE INDEX IF NOT EXISTS idx_goals_type_priority
  ON public.goals (family_group_id, goal_type, priority)
  WHERE status = 'active';

-- Alertas a disparar (cron do n8n consulta isso a cada hora)
CREATE INDEX IF NOT EXISTS idx_scheduled_alerts_due
  ON public.scheduled_alerts (trigger_at)
  WHERE status = 'pending';

-- ============================================================
-- BLOCO 12: RLS DAS NOVAS TABELAS
-- ============================================================

ALTER TABLE public.exchange_rates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_alerts   ENABLE ROW LEVEL SECURITY;

-- Taxas de câmbio: leitura para todos os usuários autenticados
DROP POLICY IF EXISTS "authenticated_read_exchange_rates" ON public.exchange_rates;
CREATE POLICY "authenticated_read_exchange_rates" ON public.exchange_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Somente service_role pode escrever taxas (via n8n)
DROP POLICY IF EXISTS "service_role_write_exchange_rates" ON public.exchange_rates;
CREATE POLICY "service_role_write_exchange_rates" ON public.exchange_rates
  FOR ALL USING (auth.role() = 'service_role');

-- Alertas: membros do grupo podem ler seus alertas
DROP POLICY IF EXISTS "family_members_read_alerts" ON public.scheduled_alerts;
CREATE POLICY "family_members_read_alerts" ON public.scheduled_alerts
  FOR SELECT USING (
    family_group_id IN (
      SELECT family_group_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

-- Membros podem criar e cancelar seus próprios alertas
DROP POLICY IF EXISTS "family_members_manage_alerts" ON public.scheduled_alerts;
CREATE POLICY "family_members_manage_alerts" ON public.scheduled_alerts
  FOR ALL USING (
    family_group_id IN (
      SELECT family_group_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

COMMIT;
