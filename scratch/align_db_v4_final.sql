-- ============================================================
-- 🌌 VESPER FINANCE — ALINHAMENTO FINAL DE SCHEMA V4
-- Resolve: Colunas faltantes (updated_at, reference_month)
-- Resolve: Erros de data (30 de fevereiro)
-- Resolve: Sincronização de faturas
-- ============================================================

BEGIN;

-- 1. Garantir que a coluna updated_at existe em transactions
-- (O erro 42703 ocorreu porque a trigger ou update tentou usar essa coluna)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='updated_at') THEN
    ALTER TABLE public.transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- 2. Ajustar nomes de colunas na tabela credit_card_invoices
DO $$ 
BEGIN
  -- Tentar renomear billing_month -> reference_month se existir
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='billing_month') THEN
    ALTER TABLE public.credit_card_invoices RENAME COLUMN billing_month TO reference_month;
  END IF;
  
  -- Tentar renomear total_amount_cents -> amount_cents se existir
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='total_amount_cents') THEN
    ALTER TABLE public.credit_card_invoices RENAME COLUMN total_amount_cents TO amount_cents;
  END IF;

  -- Garantir que a coluna reference_month exista (caso a tabela tenha sido criada sem ela)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='reference_month') THEN
    ALTER TABLE public.credit_card_invoices ADD COLUMN reference_month VARCHAR(7);
  END IF;
  
  -- Garantir que a coluna amount_cents exista
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='amount_cents') THEN
    ALTER TABLE public.credit_card_invoices ADD COLUMN amount_cents BIGINT DEFAULT 0;
  END IF;
END $$;

-- 3. Função auxiliar para gerar datas seguras (evita erros como 30 de fevereiro)
CREATE OR REPLACE FUNCTION fn_safe_date(p_year int, p_month int, p_day int)
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
EXCEPTION WHEN OTHERS THEN
    -- Fallback de segurança em caso de parâmetros inválidos
    RETURN (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
END;
$$ LANGUAGE plpgsql;

-- 4. Função de vínculo de transações (Lógica de Faturas Inteligente)
CREATE OR REPLACE FUNCTION trg_link_credit_card_transaction()
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
    -- Buscar detalhes da conta (Cartão de Crédito)
    SELECT type, closing_day, due_day INTO v_account_type, v_closing_day, v_due_day
    FROM accounts WHERE id = NEW.account_id;

    -- Só processa se for conta de crédito e tiver dia de fechamento definido
    IF v_account_type != 'CREDIT_CARD' OR v_closing_day IS NULL THEN
        RETURN NEW;
    END IF;

    v_base_date := NEW.date::DATE;

    -- 1. Calcular fechamento seguro para o mês da transação
    v_test_closing_date := fn_safe_date(
        extract(year from v_base_date)::int, 
        extract(month from v_base_date)::int, 
        v_closing_day
    );

    -- 2. Determinar se a compra cai na fatura atual ou na próxima
    IF v_base_date <= v_test_closing_date THEN
        v_invoice_month := v_test_closing_date;
    ELSE
        v_invoice_month := (v_test_closing_date + interval '1 month')::date;
    END IF;

    -- 3. Calcular data de vencimento de forma segura
    IF v_due_day < v_closing_day THEN
        -- Vence no mês seguinte ao fechamento
        v_invoice_due_date := fn_safe_date(
            extract(year from v_invoice_month + interval '1 month')::int, 
            extract(month from v_invoice_month + interval '1 month')::int, 
            v_due_day
        );
    ELSE
        -- Vence no mesmo mês do fechamento (ex: fecha dia 1, vence dia 10)
        v_invoice_due_date := fn_safe_date(
            extract(year from v_invoice_month)::int, 
            extract(month from v_invoice_month)::int, 
            v_due_day
        );
    END IF;

    v_reference_month := to_char(v_invoice_due_date, 'YYYY-MM');

    -- 4. Buscar ou Criar a fatura correspondente
    SELECT id INTO v_invoice_id FROM credit_card_invoices
    WHERE account_id = NEW.account_id AND reference_month = v_reference_month;

    IF v_invoice_id IS NULL THEN
        INSERT INTO credit_card_invoices (
            account_id, reference_month, closing_date, due_date, amount_cents, paid_amount_cents, status
        ) VALUES (
            NEW.account_id, v_reference_month, 
            fn_safe_date(extract(year from v_invoice_month)::int, extract(month from v_invoice_month)::int, v_closing_day), 
            v_invoice_due_date, 0, 0, 'OPEN'
        ) RETURNING id INTO v_invoice_id;
    END IF;

    -- Vincular a transação à fatura encontrada/criada
    NEW.invoice_id := v_invoice_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para recalcular o total da fatura (Automático)
CREATE OR REPLACE FUNCTION trg_update_invoice_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Se houve exclusão ou mudança de fatura, atualiza a antiga
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.invoice_id IS NOT NULL THEN
            UPDATE credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE invoice_id = OLD.invoice_id AND transaction_type != 'PAYMENT')
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;

    -- Se houve inserção ou atualização, atualiza a fatura atual
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE invoice_id = NEW.invoice_id AND transaction_type != 'PAYMENT')
            WHERE id = NEW.invoice_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Recriar os Triggers com as novas definições
DROP TRIGGER IF EXISTS trg_on_credit_card_tx ON transactions;
CREATE TRIGGER trg_on_credit_card_tx
BEFORE INSERT OR UPDATE OF date, account_id, invoice_id
ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_link_credit_card_transaction();

DROP TRIGGER IF EXISTS trg_update_invoice_amount_after ON transactions;
CREATE TRIGGER trg_update_invoice_amount_after
AFTER INSERT OR UPDATE OF amount_cents, invoice_id, transaction_type OR DELETE
ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_update_invoice_amount();

-- 7. SINCRONIZAÇÃO EM MASSA (BACKFILL)
-- Este passo força o reprocessamento de todas as transações de cartão de crédito.
-- Isso vai vincular cada transação à fatura correta e atualizar os saldos totais.
UPDATE transactions 
SET invoice_id = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE account_id IN (SELECT id FROM accounts WHERE type = 'CREDIT_CARD');

COMMIT;
