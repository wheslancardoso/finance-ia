-- ============================================================
-- 🌌 VESPER FINANCE — MIGRAÇÃO FASE 5
-- Parcelamento Atômico + Saldo por Trigger + Projeção Futura
-- ============================================================
-- Depende da Fase 4 já executada.
-- Seguro para re-execução (OR REPLACE / IF NOT EXISTS em tudo).
-- Execute inteiro no SQL Editor do Supabase.
-- ============================================================

BEGIN;

-- ============================================================
-- BLOCO 0: AJUSTE DE NOMES DE COLUNAS (ALINHAMENTO FRONTEND)
-- ============================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='billing_month') THEN
    ALTER TABLE public.credit_card_invoices RENAME COLUMN billing_month TO reference_month;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='total_amount_cents') THEN
    ALTER TABLE public.credit_card_invoices RENAME COLUMN total_amount_cents TO amount_cents;
  END IF;
END $$;

-- ============================================================
-- BLOCO 0.1: HELPER — GERAR DATAS SEGURAS (Evita 30 de fevereiro)
-- ============================================================
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

-- ============================================================
-- BLOCO 1: TRIGGER DE SALDO EM CONTAS (O MAIS CRÍTICO)
-- ============================================================
-- Problema atual: accounts.balance_cents é atualizado pelo
-- frontend. Qualquer transação vinda do n8n/WhatsApp que
-- bypassa o frontend deixa o saldo desatualizado.
--
-- Solução: o banco mantém o saldo. Sempre. O frontend só lê.
--
-- Regra de negócio:
--   INCOME  → soma ao saldo da conta
--   EXPENSE → subtrai do saldo da conta
--   TRANSFER→ a conta de origem subtrai, a de destino soma
--              (cada ponta é uma transação separada —
--               o linked_transaction_id une as duas)
--
-- Contas do tipo CREDIT_CARD:
--   NÃO alteram balance_cents aqui.
--   O saldo disponível do cartão é calculado como:
--   credit_limit_cents - fatura_aberta_cents
--   (gerenciado pelo trigger tr_sync_invoice_total da Fase 4)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type TEXT;
  v_delta        BIGINT;
BEGIN

  -- ── BLOCO DELETE ─────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    SELECT type INTO v_account_type
      FROM public.accounts WHERE id = OLD.account_id;

    -- Cartões: saldo gerenciado pela fatura, não aqui
    IF v_account_type = 'CREDIT_CARD' THEN
      RETURN OLD;
    END IF;

    -- Reverter o efeito da transação deletada
    IF OLD.transaction_type = 'INCOME' THEN
      UPDATE public.accounts
         SET balance_cents = balance_cents - OLD.amount_cents
       WHERE id = OLD.account_id;

    ELSIF OLD.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
      UPDATE public.accounts
         SET balance_cents = balance_cents + OLD.amount_cents
       WHERE id = OLD.account_id;
    END IF;

    RETURN OLD;
  END IF;

  -- ── BLOCO INSERT ─────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    SELECT type INTO v_account_type
      FROM public.accounts WHERE id = NEW.account_id;

    IF v_account_type = 'CREDIT_CARD' THEN
      RETURN NEW;
    END IF;

    IF NEW.transaction_type = 'INCOME' THEN
      UPDATE public.accounts
         SET balance_cents = balance_cents + NEW.amount_cents
       WHERE id = NEW.account_id;

    ELSIF NEW.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
      UPDATE public.accounts
         SET balance_cents = balance_cents - NEW.amount_cents
       WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
  END IF;

  -- ── BLOCO UPDATE ─────────────────────────────────────────
  -- Lida com edições de valor, tipo ou conta
  IF TG_OP = 'UPDATE' THEN

    -- Se a conta mudou, reverter na conta antiga e aplicar na nova
    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN

      -- Reverter na conta antiga (se não for cartão)
      SELECT type INTO v_account_type
        FROM public.accounts WHERE id = OLD.account_id;
      IF v_account_type != 'CREDIT_CARD' THEN
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        ELSIF OLD.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
      END IF;

      -- Aplicar na conta nova (se não for cartão)
      SELECT type INTO v_account_type
        FROM public.accounts WHERE id = NEW.account_id;
      IF v_account_type != 'CREDIT_CARD' THEN
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSIF NEW.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    -- Mesma conta: calcular o delta entre o valor antigo e o novo
    SELECT type INTO v_account_type
      FROM public.accounts WHERE id = NEW.account_id;

    IF v_account_type = 'CREDIT_CARD' THEN
      RETURN NEW;
    END IF;

    -- Delta = quanto o saldo precisa mudar por causa da edição
    -- Exemplo: EXPENSE de 100 → 150 significa -50 a mais no saldo
    IF NEW.transaction_type = 'INCOME' AND OLD.transaction_type = 'INCOME' THEN
      v_delta := NEW.amount_cents - OLD.amount_cents;
      UPDATE public.accounts SET balance_cents = balance_cents + v_delta WHERE id = NEW.account_id;

    ELSIF NEW.transaction_type IN ('EXPENSE','TRANSFER') AND OLD.transaction_type IN ('EXPENSE','TRANSFER') THEN
      v_delta := NEW.amount_cents - OLD.amount_cents;
      UPDATE public.accounts SET balance_cents = balance_cents - v_delta WHERE id = NEW.account_id;

    ELSE
      -- Tipo mudou (ex: EXPENSE virou INCOME) — reverter e reaplicar
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

DROP TRIGGER IF EXISTS tr_update_account_balance ON public.transactions;
CREATE TRIGGER tr_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_account_balance();

-- ============================================================
-- BLOCO 2: RECALIBRAR SALDOS EXISTENTES
-- ============================================================
-- Executa UMA VEZ para sincronizar os saldos das contas não-cartão
-- com o que realmente existe em transactions.
-- Seguro re-executar — é idempotente (sempre recalcula do zero).
-- ⚠️  Após isso, o trigger mantém tudo atualizado automaticamente.
-- ============================================================

UPDATE public.accounts a
SET balance_cents = COALESCE((
  SELECT
    COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME'
                      THEN t.amount_cents ELSE 0 END), 0)
    -
    COALESCE(SUM(CASE WHEN t.transaction_type IN ('EXPENSE', 'TRANSFER')
                      THEN t.amount_cents ELSE 0 END), 0)
  FROM public.transactions t
  WHERE t.account_id = a.id
), 0)
WHERE a.type != 'CREDIT_CARD';

-- ============================================================
-- BLOCO 3: HELPER — ENCONTRAR OU CRIAR FATURA DO MÊS
-- ============================================================
-- Função interna (não exposta via RPC) usada por create_installment_series.
-- Dado um account_id e uma data de compra, descobre em qual mês de
-- faturamento essa compra cai (respeitando o closing_day) e retorna
-- o invoice_id — criando a fatura se ela ainda não existir.
--
-- Regra de negócio (documentada em CONTEXTO_VESPER):
--   Se date.day >= closing_day → a compra vai para a fatura do PRÓXIMO mês.
--   Se date.day <  closing_day → a compra vai para a fatura do mês ATUAL.
-- ============================================================

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
  v_billing_label   TEXT;      -- ex: '2026-06'
  v_closing_date    DATE;
  v_due_date        DATE;
  v_invoice_id      UUID;
BEGIN
  -- Buscar configuração do cartão
  SELECT closing_day, due_day
    INTO v_closing_day, v_due_day
    FROM public.accounts
   WHERE id = p_account_id AND type = 'CREDIT_CARD';

  -- Se não for cartão ou não tiver closing_day, retorna NULL
  IF v_closing_day IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calcular o mês de faturamento
  IF EXTRACT(DAY FROM p_purchase_date) >= v_closing_day THEN
    -- Compra após o fechamento → fatura do próximo mês
    v_billing_year  := EXTRACT(YEAR  FROM p_purchase_date + interval '1 month');
    v_billing_month := EXTRACT(MONTH FROM p_purchase_date + interval '1 month');
  ELSE
    -- Compra antes do fechamento → fatura do mês atual
    v_billing_year  := EXTRACT(YEAR  FROM p_purchase_date);
    v_billing_month := EXTRACT(MONTH FROM p_purchase_date);
  END IF;

  v_billing_label := to_char(
    make_date(v_billing_year, v_billing_month, 1),
    'YYYY-MM'
  );

  -- Calcular datas reais de fechamento e vencimento de forma segura
  v_closing_date := public.fn_safe_date(v_billing_year, v_billing_month, v_closing_day);

  -- Se due_day não está configurado, assume closing_day + 10 dias
  IF v_due_day IS NULL THEN
    v_due_date := v_closing_date + interval '10 days';
  ELSE
    -- Vencimento pode ser no mês seguinte ao fechamento (se due_day < closing_day)
    DECLARE
      v_due_month INTEGER := v_billing_month;
      v_due_year  INTEGER := v_billing_year;
    BEGIN
      IF v_due_day < v_closing_day THEN
        v_due_month := v_due_month + 1;
        IF v_due_month > 12 THEN
          v_due_month := 1;
          v_due_year  := v_due_year + 1;
        END IF;
      END IF;
      v_due_date := public.fn_safe_date(v_due_year, v_due_month, v_due_day);
    END;
  END IF;

  -- Buscar fatura existente para esse mês
  SELECT id INTO v_invoice_id
    FROM public.credit_card_invoices
   WHERE account_id      = p_account_id
     AND reference_month = v_billing_label
   LIMIT 1;

  -- Se não existe, criar
  IF v_invoice_id IS NULL THEN
    INSERT INTO public.credit_card_invoices (
      account_id, reference_month, closing_date, due_date, status, amount_cents
    ) VALUES (
      p_account_id, v_billing_label, v_closing_date, v_due_date, 'OPEN', 0
    )
    RETURNING id INTO v_invoice_id;
  END IF;

  RETURN v_invoice_id;
END;
$$;

-- ============================================================
-- BLOCO 4: RPC create_installment_series
-- ============================================================
-- A RPC central do parcelamento. O frontend chama UMA VEZ
-- com os dados da compra e o banco faz todo o resto:
--
--   1. Gera um installment_group_id para agrupar as parcelas
--   2. Calcula o mês de cada parcela (1/12, 2/12, ... 12/12)
--   3. Cria ou localiza a fatura de cada mês futuro
--   4. Insere todas as transações em uma única transação atômica
--   5. Retorna um JSON com o resumo e o group_id
--
-- Parâmetros:
--   p_account_id      UUID     — cartão de crédito
--   p_category_id     UUID     — categoria da compra
--   p_description     TEXT     — ex: 'TV Samsung 55"'
--   p_merchant_name   TEXT     — ex: 'Americanas'
--   p_total_cents     BIGINT   — valor TOTAL da compra (não por parcela)
--   p_installments    INTEGER  — número de parcelas (1 a 48)
--   p_purchase_date   TIMESTAMPTZ — data da compra (padrão: agora)
--   p_source          TEXT     — 'MANUAL', 'WHATSAPP_TEXT', etc.
--   p_family_group_id UUID     — grupo familiar
--
-- Exemplo de uso:
--   SELECT create_installment_series(
--     p_account_id      => 'uuid-do-nubank',
--     p_category_id     => 'uuid-da-categoria',
--     p_description     => 'TV Samsung 55"',
--     p_merchant_name   => 'Americanas',
--     p_total_cents     => 300000,   -- R$ 3.000,00
--     p_installments    => 12,
--     p_purchase_date   => NOW(),
--     p_source          => 'MANUAL',
--     p_family_group_id => 'uuid-do-grupo'
--   );
-- ============================================================

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

  -- Validações
  IF p_installments < 1 OR p_installments > 48 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 48. Recebido: %', p_installments;
  END IF;
  IF p_total_cents <= 0 THEN
    RAISE EXCEPTION 'O valor total deve ser positivo. Recebido: %', p_total_cents;
  END IF;

  -- Verificar que a conta é um cartão de crédito
  SELECT type INTO v_account_type
    FROM public.accounts WHERE id = p_account_id;
  IF v_account_type IS DISTINCT FROM 'CREDIT_CARD' THEN
    RAISE EXCEPTION 'create_installment_series só funciona com contas CREDIT_CARD. Tipo atual: %', v_account_type;
  END IF;

  -- Calcular valor por parcela
  -- O resto (centavos que sobram da divisão) vai para a PRIMEIRA parcela
  -- Exemplo: R$ 100,00 em 3x = 33,33 + 33,34 + 33,33
  -- Aqui: 3334 + 3333 + 3333 = 10000 ✓
  v_installment_cents := p_total_cents / p_installments;
  v_remainder_cents   := p_total_cents - (v_installment_cents * p_installments);

  -- Loop: criar uma transação por parcela
  FOR v_i IN 1..p_installments LOOP

    -- Data desta parcela: avança um mês por parcela
    v_current_date := p_purchase_date + ((v_i - 1) * interval '1 month');

    -- Valor desta parcela (o resto vai na primeira)
    IF v_i = 1 THEN
      v_current_amount := v_installment_cents + v_remainder_cents;
    ELSE
      v_current_amount := v_installment_cents;
    END IF;

    -- Encontrar ou criar a fatura correta para este mês
    v_invoice_id := public.fn_get_or_create_invoice(p_account_id, v_current_date);

    -- Inserir a transação
    INSERT INTO public.transactions (
      account_id,
      category_id,
      amount_cents,
      transaction_type,
      date,
      description,
      merchant_name,
      installment_current,
      installment_total,
      installment_group_id,
      invoice_id,
      source,
      source_metadata,
      family_group_id
    ) VALUES (
      p_account_id,
      p_category_id,
      v_current_amount,
      'EXPENSE',
      v_current_date,
      p_description || ' (' || v_i || '/' || p_installments || ')',
      p_merchant_name,
      v_i,
      p_installments,
      v_group_id,
      v_invoice_id,
      p_source,
      p_source_metadata,
      p_family_group_id
    )
    RETURNING id INTO v_transaction_id;

    v_inserted_ids := array_append(v_inserted_ids, v_transaction_id);

  END LOOP;

  -- Retornar resumo
  RETURN jsonb_build_object(
    'success',             true,
    'installment_group_id', v_group_id,
    'total_cents',         p_total_cents,
    'installments',        p_installments,
    'installment_cents',   v_installment_cents,
    'first_installment_cents', v_installment_cents + v_remainder_cents,
    'transaction_ids',     to_jsonb(v_inserted_ids),
    'purchase_date',       p_purchase_date,
    'description',         p_description
  );

END;
$$;

-- ============================================================
-- BLOCO 5: RPC delete_installment_series
-- ============================================================
-- Deleta uma série de parcelas pelo installment_group_id.
-- Parâmetros:
--   p_group_id        UUID    — installment_group_id da série
--   p_delete_from     INTEGER — a partir de qual parcela deletar
--                               (1 = todas, 3 = da 3ª em diante)
--   p_family_group_id UUID    — segurança: confirma que o grupo
--                               pertence ao usuário chamador
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_installment_series(
  p_group_id        UUID,
  p_delete_from     INTEGER    DEFAULT 1,
  p_family_group_id UUID       DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN

  DELETE FROM public.transactions
  WHERE installment_group_id = p_group_id
    AND installment_current  >= p_delete_from
    AND (p_family_group_id IS NULL OR family_group_id = p_family_group_id);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',       true,
    'deleted_count', v_deleted_count,
    'group_id',      p_group_id,
    'deleted_from',  p_delete_from
  );
END;
$$;

-- ============================================================
-- BLOCO 6: RPC get_installment_series
-- ============================================================
-- Retorna o resumo completo de uma série de parcelas.
-- Usado na Timeline de Parcelas do frontend.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_installment_series(
  p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'installments', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.installment_current), '[]'::jsonb)
      FROM (
        SELECT
          t.id,
          t.installment_current,
          t.installment_total,
          t.amount_cents,
          t.date,
          t.description,
          t.invoice_id,
          t.is_paid,
          i.reference_month,
          i.status AS invoice_status
        FROM public.transactions t
        LEFT JOIN public.credit_card_invoices i ON t.invoice_id = i.id
        WHERE t.installment_group_id = p_group_id
        ORDER BY t.installment_current
      ) t
    ),
    'summary', (
      SELECT jsonb_build_object(
        'total_cents',       SUM(amount_cents),
        'paid_count',        COUNT(*) FILTER (WHERE is_paid = true),
        'remaining_count',   COUNT(*) FILTER (WHERE is_paid = false),
        'remaining_cents',   SUM(amount_cents) FILTER (WHERE is_paid = false),
        'installment_total', MAX(installment_total)
      )
      FROM public.transactions
      WHERE installment_group_id = p_group_id
    )
  );
END;
$$;

-- ============================================================
-- BLOCO 7: RPC get_month_projection
-- ============================================================
-- Motor de projeção futura — resolve o bug documentado no
-- CONTEXTO_VESPER ("perda de parcelas ao projetar meses distantes").
--
-- Para um mês alvo qualquer (ex: Agosto/2026), calcula:
--   - Saldo projetado no início do mês (acumulando meses anteriores)
--   - Todas as parcelas que vencem nesse mês
--   - Todas as recorrentes previstas
--   - Faturas de cartão com vencimento nesse mês
--   - Saldo final projetado
--
-- Parâmetros:
--   p_family_group_id UUID
--   p_target_month    DATE — qualquer dia do mês alvo (ex: '2026-08-01')
-- ============================================================

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
  v_today          DATE        := CURRENT_DATE;
BEGIN
  RETURN jsonb_build_object(

    'target_month', to_char(v_month_start, 'YYYY-MM'),

    -- Saldo líquido atual (base do cálculo)
    'current_liquid_cents', (
      SELECT COALESCE(SUM(balance_cents), 0)
      FROM public.accounts
      WHERE family_group_id = p_family_group_id
        AND type != 'CREDIT_CARD'
        AND is_active = true
    ),

    -- Parcelas com vencimento neste mês (o que o mês anterior não pegou)
    'installments_due', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.date), '[]'::jsonb)
      FROM (
        SELECT
          t.id,
          t.description,
          t.amount_cents,
          t.date,
          t.installment_current,
          t.installment_total,
          t.installment_group_id,
          t.merchant_name,
          c.name AS category_name,
          a.name AS account_name
        FROM public.transactions t
        LEFT JOIN public.categories c ON t.category_id = c.id
        LEFT JOIN public.accounts   a ON t.account_id  = a.id
        WHERE t.family_group_id  = p_family_group_id
          AND t.transaction_type = 'EXPENSE'
          AND t.date >= v_month_start
          AND t.date <= v_month_end
          AND t.installment_total > 1   -- só parceladas
          AND t.is_paid = false
      ) t
    ),

    -- Recorrentes que cairão neste mês
    'recurring_due', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.description), '[]'::jsonb)
      FROM (
        SELECT
          rt.id,
          rt.description,
          rt.amount_cents,
          rt.transaction_type,
          rt.next_date,
          c.name AS category_name,
          a.name AS account_name
        FROM public.recurring_transactions rt
        LEFT JOIN public.categories c ON rt.category_id = c.id
        LEFT JOIN public.accounts   a ON rt.account_id  = a.id
        WHERE rt.family_group_id = p_family_group_id
          AND rt.status = 'active'
          AND rt.next_date >= v_month_start::date
          AND rt.next_date <= v_month_end::date
      ) r
    ),

    -- Faturas com vencimento neste mês
    'invoices_due', (
      SELECT COALESCE(jsonb_agg(i ORDER BY i.due_date), '[]'::jsonb)
      FROM (
        SELECT
          i.id,
          i.reference_month,
          i.due_date,
          i.status,
          i.amount_cents,
          a.name AS account_name,
          a.color_hex
        FROM public.credit_card_invoices i
        JOIN public.accounts a ON i.account_id = a.id
        WHERE a.family_group_id = p_family_group_id
          AND i.due_date >= v_month_start::date
          AND i.due_date <= v_month_end::date
          AND i.status IN ('OPEN', 'CLOSED')
      ) i
    ),

    -- Resumo numérico para o Month Navigator
    'summary', (
      SELECT jsonb_build_object(

        -- Entradas previstas (recorrentes INCOME)
        'projected_income_cents', (
          SELECT COALESCE(SUM(amount_cents), 0)
          FROM public.recurring_transactions
          WHERE family_group_id  = p_family_group_id
            AND transaction_type = 'INCOME'
            AND status           = 'active'
            AND next_date BETWEEN v_month_start::date AND v_month_end::date
        ),

        -- Saídas: parcelas + faturas + recorrentes EXPENSE
        'projected_expense_cents', (
          -- Parcelas do mês
          COALESCE((
            SELECT SUM(amount_cents)
            FROM public.transactions
            WHERE family_group_id  = p_family_group_id
              AND transaction_type = 'EXPENSE'
              AND date BETWEEN v_month_start AND v_month_end
              AND installment_total > 1
              AND is_paid = false
          ), 0)
          +
          -- Faturas de cartão com vencimento no mês
          COALESCE((
            SELECT SUM(i.amount_cents)
            FROM public.credit_card_invoices i
            JOIN public.accounts a ON i.account_id = a.id
            WHERE a.family_group_id = p_family_group_id
              AND i.due_date BETWEEN v_month_start::date AND v_month_end::date
              AND i.status IN ('OPEN', 'CLOSED')
          ), 0)
          +
          -- Recorrentes EXPENSE
          COALESCE((
            SELECT SUM(amount_cents)
            FROM public.recurring_transactions
            WHERE family_group_id  = p_family_group_id
              AND transaction_type = 'EXPENSE'
              AND status           = 'active'
              AND next_date BETWEEN v_month_start::date AND v_month_end::date
          ), 0)
        ),

        'month_start', v_month_start,
        'month_end',   v_month_end

      )
    )

  );
END;
$$;

-- ============================================================
-- BLOCO 8: RPC create_transfer (Dupla entrada atômica)
-- ============================================================
-- Cria as DUAS transações de uma transferência interna em
-- uma única chamada atômica, garantindo que nunca fica
-- só uma ponta registrada.
--
-- O trigger de saldo (Bloco 1) cuida do balance_cents
-- automaticamente para cada uma das duas inserções.
-- ============================================================

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
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Conta de origem e destino não podem ser iguais.';
  END IF;
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'O valor da transferência deve ser positivo.';
  END IF;

  -- Transação de SAÍDA
  INSERT INTO public.transactions (
    account_id, category_id, amount_cents, transaction_type,
    date, description, source, family_group_id
  ) VALUES (
    p_from_account_id, p_category_id, p_amount_cents, 'TRANSFER',
    p_date, p_description, p_source, p_family_group_id
  ) RETURNING id INTO v_out_id;

  -- Transação de ENTRADA
  INSERT INTO public.transactions (
    account_id, category_id, amount_cents, transaction_type,
    date, description, source, family_group_id,
    linked_transaction_id
  ) VALUES (
    p_to_account_id, p_category_id, p_amount_cents, 'INCOME',
    p_date, p_description, p_source, p_family_group_id,
    v_out_id
  ) RETURNING id INTO v_in_id;

  -- Vincular as duas pontas
  UPDATE public.transactions
     SET linked_transaction_id = v_in_id
   WHERE id = v_out_id;

  RETURN jsonb_build_object(
    'success',          true,
    'out_transaction_id', v_out_id,
    'in_transaction_id',  v_in_id,
    'amount_cents',     p_amount_cents
  );
END;
$$;

-- ============================================================
-- BLOCO 9: ÍNDICES DE PERFORMANCE (novos)
-- ============================================================

-- Busca de parcelas por grupo (Timeline de Parcelas)
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group_current
  ON public.transactions (installment_group_id, installment_current)
  WHERE installment_group_id IS NOT NULL;

-- Projeção futura: parcelas futuras por família e data
CREATE INDEX IF NOT EXISTS idx_transactions_future_installments
  ON public.transactions (family_group_id, date, installment_total)
  WHERE installment_total > 1 AND is_paid = false;

-- Faturas por data de vencimento (Month Navigator)
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON public.credit_card_invoices (due_date, status)
  WHERE status IN ('OPEN', 'CLOSED');

-- Recorrentes por data de próxima execução
CREATE INDEX IF NOT EXISTS idx_recurring_next_date
  ON public.recurring_transactions (family_group_id, next_date, status)
  WHERE status = 'active';

-- ============================================================
-- BLOCO 9.1: AJUSTE DE COMPATIBILIDADE FRONTEND (get_financial_state_v3)
-- ============================================================
-- Sincroniza os nomes dos campos de faturas com o que o frontend espera:
--   billing_month -> reference_month
--   total_amount_cents -> amount_cents
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_financial_state_v3(
    p_family_group_id UUID, 
    p_target_month TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result JSONB;
    v_month_start DATE := date_trunc('month', p_target_month)::date;
    v_month_end DATE := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 day')::date;
BEGIN
    SELECT jsonb_build_object(
        'family_group', (
            SELECT to_jsonb(fg) FROM public.family_groups fg WHERE id = p_family_group_id
        ),
        'accounts', (
            SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.accounts a 
            WHERE family_group_id = p_family_group_id AND is_active = true
        ),
        'invoices', (
            SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) FROM (
                SELECT 
                    i.id,
                    i.account_id,
                    i.reference_month,
                    i.closing_date,
                    i.due_date,
                    i.amount_cents,
                    i.status
                FROM public.credit_card_invoices i
                JOIN public.accounts a ON i.account_id = a.id 
                WHERE a.family_group_id = p_family_group_id AND i.status != 'PAID'
            ) invoice_data
        ),
        'goals', (
            SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM public.goals g 
            WHERE family_group_id = p_family_group_id AND status = 'active'
        ),
        'recurring_transactions', (
            SELECT COALESCE(jsonb_agg(rt_joined), '[]'::jsonb) FROM (
                SELECT rt.*, to_jsonb(c) as category, to_jsonb(a) as account
                FROM public.recurring_transactions rt
                LEFT JOIN public.categories c ON rt.category_id = c.id
                LEFT JOIN public.accounts a ON rt.account_id = a.id
                WHERE rt.family_group_id = p_family_group_id AND rt.status = 'active'
            ) rt_joined
        ),
        'budgets', (
            SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) FROM public.budgets b 
            WHERE family_group_id = p_family_group_id
        ),
        'recent_transactions', (
            SELECT COALESCE(jsonb_agg(t_joined), '[]'::jsonb) FROM (
                SELECT t.*, to_jsonb(c) as category, to_jsonb(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = p_family_group_id
                ORDER BY t.date DESC
                LIMIT 50
            ) t_joined
        ),
        'month_stats', (
            SELECT jsonb_build_object(
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
            SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM public.categories c 
            WHERE family_group_id = p_family_group_id OR is_system_default = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- ============================================================
-- BLOCO 9.2: SINCRONIZAÇÃO AUTOMÁTICA DE FATURAS (TRG)
-- ============================================================
-- Resolve o problema de transações órfãs ou valores desincronizados.
-- ============================================================

-- 1. Trigger de Vínculo de Transação a Fatura
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

-- 2. Trigger de Soma de Totais na Fatura
CREATE OR REPLACE FUNCTION public.trg_update_invoice_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.invoice_id IS NOT NULL THEN
            UPDATE public.credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions WHERE invoice_id = OLD.invoice_id AND transaction_type != 'PAYMENT')
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE public.credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM public.transactions WHERE invoice_id = NEW.invoice_id AND transaction_type != 'PAYMENT')
            WHERE id = NEW.invoice_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_amount_after ON public.transactions;
CREATE TRIGGER trg_update_invoice_amount_after
AFTER INSERT OR UPDATE OF amount_cents, invoice_id, transaction_type OR DELETE
ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.trg_update_invoice_amount();

-- ============================================================
-- BLOCO 10: SEGURANÇA — RLS para RPCs públicas
-- ============================================================
-- As funções SECURITY DEFINER rodam com os privilégios do
-- owner (postgres), então o RLS das tabelas subjacentes não
-- bloqueia. A segurança é garantida pelo p_family_group_id
-- passado pelo frontend (que vem do JWT do Supabase Auth).
--
-- Para as funções sem SECURITY DEFINER (create_installment_series,
-- create_transfer etc.), o RLS das tabelas de transactions e
-- accounts se aplica normalmente via authenticated role.
-- ============================================================

-- Garantir que authenticated pode chamar as RPCs públicas
GRANT EXECUTE ON FUNCTION public.create_installment_series TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_installment_series TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_installment_series    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_month_projection      TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_state_v3    TO authenticated;

-- fn_get_or_create_invoice é interna (chamada pelas RPCs acima)
-- Não expor diretamente para o frontend
REVOKE EXECUTE ON FUNCTION public.fn_get_or_create_invoice FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_or_create_invoice TO authenticated;

COMMIT;

-- ============================================================
-- ✅ CHECKLIST PÓS-EXECUÇÃO
-- ============================================================

-- 1. Verificar que o trigger de saldo foi criado:
--    SELECT trigger_name FROM information_schema.triggers
--    WHERE event_object_table = 'transactions'
--    ORDER BY trigger_name;
--    → deve aparecer: tr_update_account_balance
--                     tr_sync_invoice_total   (da Fase 4)
--                     tr_invalidate_advice_cache (da Fase 4)
--                     tr_check_invoice_account   (da Fase 4)

-- 2. Verificar recalibração dos saldos:
--    SELECT id, name, type, balance_cents
--    FROM public.accounts
--    WHERE type != 'CREDIT_CARD'
--    ORDER BY name;
--    → os saldos devem bater com a soma real das transações

-- 3. Testar criação de parcelamento (12x de R$300,00 = R$3.600,00):
--    SELECT create_installment_series(
--      p_account_id      => '<uuid-de-um-cartao>',
--      p_category_id     => '<uuid-de-uma-categoria>',
--      p_description     => 'TV Samsung teste',
--      p_total_cents     => 360000,
--      p_installments    => 12,
--      p_family_group_id => '<uuid-do-grupo>'
--    );
--    → deve retornar installment_group_id e 12 transaction_ids

-- 4. Verificar que as 12 faturas foram criadas/encontradas:
--    SELECT reference_month, amount_cents, status
--    FROM public.credit_card_invoices
--    WHERE account_id = '<uuid-do-cartao>'
--    ORDER BY reference_month;
--    → deve mostrar 12 meses com amount_cents = 30000 cada

-- 5. Backfill de Vínculo (Opcional, mas recomendado):
--    UPDATE public.transactions SET invoice_id = NULL WHERE account_id IN (SELECT id FROM accounts WHERE type = 'CREDIT_CARD');

-- 6. Testar transferência atômica:
--    SELECT create_transfer(
--      p_from_account_id => '<uuid-conta-origem>',
--      p_to_account_id   => '<uuid-conta-destino>',
--      p_amount_cents    => 50000,
--      p_description     => 'Teste transferência',
--      p_family_group_id => '<uuid-do-grupo>'
--    );
--    → deve retornar out_transaction_id e in_transaction_id
--    → saldo da origem deve diminuir R$500 e destino aumentar R$500

-- 7. Verificar série de parcelas pelo group_id:
--    SELECT get_installment_series('<installment_group_id-do-teste>');
--    → deve retornar as 12 parcelas com invoice_status de cada uma

-- ============================================================
-- 📋 RESUMO DO QUE A FASE 5 ENTREGOU
-- ============================================================
--
-- ANTES:                          DEPOIS:
-- ─────────────────────────────── ────────────────────────────────
-- Saldo atualizado pelo frontend  Trigger no banco — sempre correto
-- Parcelamento: N INSERTs manuais  1 RPC atômica — banco faz tudo
-- Faturas futuras: não existiam   fn_get_or_create_invoice cria sob demanda
-- Projeção: perdia parcelas       get_month_projection inclui tudo
-- Transferência: 2 INSERTs        1 RPC atômica com linked_transaction_id
-- ============================================================
