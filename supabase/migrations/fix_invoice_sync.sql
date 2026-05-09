-- ============================================================
-- 🌌 VESPER FINANCE — CORREÇÃO DE SINCRONIZAÇÃO DE FATURAS
-- Objetivo: Vincular transações de cartão existentes às faturas
-- e garantir que novos lançamentos sejam calculados.
-- ============================================================

BEGIN;

-- 0. Ajustar nomes de colunas para consistência com o Dashboard v3
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='billing_month') THEN
    ALTER TABLE public.credit_card_invoices RENAME COLUMN billing_month TO reference_month;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='total_amount_cents') THEN
    ALTER TABLE public.credit_card_invoices RENAME COLUMN total_amount_cents TO amount_cents;
  END IF;
END $$;

-- 1. Função auxiliar para gerar datas seguras (ex: evita 30 de fevereiro)
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
END;
$$ LANGUAGE plpgsql;

-- 2. Garantir que a função de vínculo existe e está atualizada
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
    -- Obter detalhes da conta
    SELECT type, closing_day, due_day 
    INTO v_account_type, v_closing_day, v_due_day
    FROM accounts WHERE id = NEW.account_id;

    -- Se não for cartão ou não tiver dados de fechamento, não faz nada
    IF v_account_type != 'CREDIT_CARD' OR v_closing_day IS NULL THEN
        RETURN NEW;
    END IF;

    -- Usa a data da transação
    v_base_date := NEW.date::DATE;

    -- Montar a data de fechamento para o mês da transação de forma segura
    v_test_closing_date := fn_safe_date(
        extract(year from v_base_date)::int, 
        extract(month from v_base_date)::int, 
        v_closing_day
    );

    -- Determinar a qual ciclo a compra pertence
    IF v_base_date <= v_test_closing_date THEN
        v_invoice_month := v_test_closing_date;
    ELSE
        v_invoice_month := v_test_closing_date + interval '1 month';
    END IF;

    -- Calcular Vencimento da Fatura de forma segura
    IF v_due_day < v_closing_day THEN
        v_invoice_due_date := fn_safe_date(
            extract(year from v_invoice_month + interval '1 month')::int, 
            extract(month from v_invoice_month + interval '1 month')::int, 
            v_due_day
        );
    ELSE
        v_invoice_due_date := fn_safe_date(
            extract(year from v_invoice_month)::int, 
            extract(month from v_invoice_month)::int, 
            v_due_day
        );
    END IF;

    v_reference_month := to_char(v_invoice_due_date, 'YYYY-MM');

    -- Tentar encontrar a fatura
    SELECT id INTO v_invoice_id
    FROM credit_card_invoices
    WHERE account_id = NEW.account_id AND reference_month = v_reference_month;

    -- Se não existir, criar a fatura
    IF v_invoice_id IS NULL THEN
        INSERT INTO credit_card_invoices (
            account_id, reference_month, closing_date, due_date, amount_cents, paid_amount_cents, status
        ) VALUES (
            NEW.account_id, v_reference_month, 
            fn_safe_date(extract(year from v_invoice_month)::int, extract(month from v_invoice_month)::int, v_closing_day), 
            v_invoice_due_date, 0, 0, 'OPEN'
        ) RETURNING id INTO v_invoice_id;
    END IF;

    NEW.invoice_id := v_invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Recriar Trigger de Vínculo
DROP TRIGGER IF EXISTS trg_on_credit_card_tx ON transactions;
CREATE TRIGGER trg_on_credit_card_tx
BEFORE INSERT OR UPDATE OF date, account_id, invoice_id
ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_link_credit_card_transaction();

-- 3. Garantir que a função de soma do total está atualizada e segura contra DELETE
CREATE OR REPLACE FUNCTION trg_update_invoice_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar a fatura antiga (se mudou de fatura ou se foi deletado)
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.invoice_id IS NOT NULL THEN
            UPDATE credit_card_invoices
            SET amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE invoice_id = OLD.invoice_id AND transaction_type != 'PAYMENT')
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;

    -- Atualizar a fatura nova (se inseriu ou atualizou)
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

-- 4. Recriar Trigger de Soma
DROP TRIGGER IF EXISTS trg_update_invoice_amount_after ON transactions;
CREATE TRIGGER trg_update_invoice_amount_after
AFTER INSERT OR UPDATE OF amount_cents, invoice_id, transaction_type OR DELETE
ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_update_invoice_amount();

-- 5. BACKFILL: Forçar vínculo de todas as transações de cartão existentes
-- Ao setar invoice_id para NULL, a trigger BEFORE recém-criada entrará em ação
-- recalculando o invoice_id correto baseado na data.
UPDATE transactions 
SET invoice_id = NULL 
WHERE account_id IN (SELECT id FROM accounts WHERE type = 'CREDIT_CARD');

COMMIT;
