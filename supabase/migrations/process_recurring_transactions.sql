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
    v_account_type TEXT;
    v_is_paid BOOLEAN;
    current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    current_month_end DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;
BEGIN
    FOR r IN 
        SELECT * FROM public.recurring_transactions 
        WHERE status = 'active'
    LOOP
        -- Calcular a data da transação para o mês atual baseando-se no dia do next_date
        target_date := (date_trunc('month', CURRENT_DATE) + (EXTRACT(DAY FROM r.next_date) - 1 || ' days')::interval)::DATE;

        -- Obter o tipo de conta para verificar se é cartão de crédito
        SELECT type INTO v_account_type FROM public.accounts WHERE id = r.account_id;

        -- Determinar se a transação deve nascer como paga
        -- Se a conta não for cartão de crédito e a data da transação for menor ou igual à data atual, nasce paga.
        IF v_account_type != 'CREDIT_CARD' AND target_date <= CURRENT_DATE THEN
            v_is_paid := true;
        ELSE
            v_is_paid := false;
        END IF;

        -- Verificar se já existe uma transação física correspondente no mês atual
        SELECT EXISTS (
            SELECT 1 FROM public.transactions
            WHERE user_id = r.user_id
              AND source_metadata->>'recurring_id' = r.id::text
              AND date >= current_month_start
              AND date <= current_month_end
        ) INTO tx_exists;

        -- Se não existir, insere com o status correto
        IF NOT tx_exists THEN
            INSERT INTO public.transactions (
                user_id, account_id, category_id, description,
                amount_cents, transaction_type, date,
                is_paid, source, source_metadata
            ) VALUES (
                r.user_id, r.account_id, r.category_id, r.description,
                r.amount_cents, r.transaction_type, target_date,
                v_is_paid, 'RECURRING', jsonb_build_object('recurring_id', r.id)
            );
        ELSE
            -- Se já existe, sincronizar descrição, categoria, conta (e o valor se não estiver paga)
            -- Além de garantir que seja marcada como paga caso necessário
            UPDATE public.transactions
            SET description = r.description,
                category_id = r.category_id,
                account_id = r.account_id,
                amount_cents = CASE WHEN is_paid = false THEN r.amount_cents ELSE amount_cents END,
                is_paid = CASE WHEN v_is_paid THEN true ELSE is_paid END
            WHERE user_id = r.user_id
              AND source_metadata->>'recurring_id' = r.id::text
              AND date >= current_month_start
              AND date <= current_month_end;
        END IF;
    END LOOP;

    -- Limpar transações duplicadas no mês atual (mesmo recurring_id + mesmo mês), mantendo apenas a mais antiga
    DELETE FROM public.transactions t1
    USING public.transactions t2
    WHERE t1.user_id = t2.user_id
      AND t1.source_metadata->>'recurring_id' = t2.source_metadata->>'recurring_id'
      AND t1.date >= current_month_start AND t1.date <= current_month_end
      AND t2.date >= current_month_start AND t2.date <= current_month_end
      AND t1.created_at > t2.created_at;

    -- UPDATE retroativo e contínuo para transações recorrentes passadas de contas não-cartão que ficaram pendentes
    UPDATE public.transactions t
    SET is_paid = true
    FROM public.accounts a
    WHERE t.account_id = a.id
      AND a.type != 'CREDIT_CARD'
      AND t.source = 'RECURRING'
      AND t.is_paid = false
      AND t.date::date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_process_recurring_transactions TO anon, authenticated, service_role;
