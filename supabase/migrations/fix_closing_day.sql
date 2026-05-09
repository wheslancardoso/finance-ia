
-- Correção da lógica de fechamento de fatura:
-- Compras no dia do fechamento devem cair na PRÓXIMA fatura.

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

    -- Montar a data de fechamento para o mês da transação
    v_test_closing_date := make_date(extract(year from v_base_date)::int, extract(month from v_base_date)::int, v_closing_day);

    -- Determinar a qual ciclo a compra pertence
    -- MUDANÇA: Se a data for IGUAL ou ANTERIOR ao dia de fechamento, pertence ao ciclo atual.
    IF v_base_date <= v_test_closing_date THEN
        -- Comprou até o dia do fechamento inclusive
        v_invoice_month := v_test_closing_date;
    ELSE
        -- Comprou DEPOIS do dia do fechamento, cai no próximo ciclo
        v_invoice_month := v_test_closing_date + interval '1 month';
    END IF;

    -- Calcular Vencimento da Fatura
    IF v_due_day < v_closing_day THEN
        v_invoice_due_date := make_date(extract(year from v_invoice_month + interval '1 month')::int, extract(month from v_invoice_month + interval '1 month')::int, v_due_day);
    ELSE
        v_invoice_due_date := make_date(extract(year from v_invoice_month)::int, extract(month from v_invoice_month)::int, v_due_day);
    END IF;

    -- O mês de referência da fatura é o mês do vencimento.
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
            make_date(extract(year from v_invoice_month)::int, extract(month from v_invoice_month)::int, v_closing_day), 
            v_invoice_due_date, 0, 0, 'OPEN'
        ) RETURNING id INTO v_invoice_id;
    END IF;

    -- Vincular a transação à fatura
    NEW.invoice_id := v_invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Garantir que a trigger exista e esteja vinculada à função correta
DROP TRIGGER IF EXISTS trg_on_credit_card_tx ON public.transactions;

CREATE TRIGGER trg_on_credit_card_tx
BEFORE INSERT OR UPDATE OF date, account_id
ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_link_credit_card_transaction();

-- Re-vincular transações existentes para corrigir possíveis erros de fechamento
DO $$
BEGIN
    UPDATE transactions 
    SET date = date
    WHERE account_id IN (SELECT id FROM accounts WHERE type = 'CREDIT_CARD');
END $$;
