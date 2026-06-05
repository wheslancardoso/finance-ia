-- ==========================================
-- Processamento de Transações Recorrentes
-- ==========================================
-- Cria função que gera transações físicas a partir de regras de recorrência ativas no mês atual.

CREATE OR REPLACE FUNCTION fn_process_recurring_transactions()
RETURNS void AS $$
DECLARE
    r RECORD;
    target_date DATE;
    tx_exists BOOLEAN;
    current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    current_month_end DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;
BEGIN
    FOR r IN 
        SELECT * FROM public.recurring_transactions 
        WHERE status = 'active'
    LOOP
        -- Calcular a data da transação para o mês atual baseando-se no dia do next_date
        target_date := (date_trunc('month', CURRENT_DATE) + (EXTRACT(DAY FROM r.next_date) - 1 || ' days')::interval)::DATE;

        -- Verificar se já existe uma transação física correspondente no mês atual
        SELECT EXISTS (
            SELECT 1 FROM public.transactions
            WHERE user_id = r.user_id
              AND source_metadata->>'recurring_id' = r.id::text
              AND date >= current_month_start
              AND date <= current_month_end
        ) INTO tx_exists;

        -- Se não existir, insere
        IF NOT tx_exists THEN
            INSERT INTO public.transactions (
                user_id, account_id, category_id, description,
                amount_cents, transaction_type, date,
                is_paid, source, source_metadata
            ) VALUES (
                r.user_id, r.account_id, r.category_id, r.description,
                r.amount_cents, r.transaction_type, target_date,
                false, 'RECURRING', jsonb_build_object('recurring_id', r.id)
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_process_recurring_transactions TO anon, authenticated, service_role;
