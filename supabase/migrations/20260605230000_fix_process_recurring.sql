-- ============================================================
-- Correção e Aprimoramento do Processamento de Recorrências
-- ============================================================
-- Esta migração redefine a função `fn_process_recurring_transactions` para:
-- 1. Suportar intervalos de dias customizados (ex: every_14_days) extraídos da descrição.
-- 2. Avançar de forma contínua o campo `next_date` na tabela `recurring_transactions`.
-- 3. Gerar transações físicas na data exata de cada ocorrência através de um loop WHILE.
-- 4. Evitar duplicidades checando a existência da transação por recurring_id + data exata.

CREATE OR REPLACE FUNCTION public.fn_process_recurring_transactions()
RETURNS void AS $$
DECLARE
    r RECORD;
    v_custom_days INT;
    v_target_date DATE;
    v_account_type TEXT;
    v_is_paid BOOLEAN;
    v_exists BOOLEAN;
    -- Limite de geração é o final do mês corrente
    v_limit_date DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;
BEGIN
    FOR r IN 
        SELECT * FROM public.recurring_transactions 
        WHERE status = 'active'
    LOOP
        -- 1. Obter tipo de conta associada
        SELECT type INTO v_account_type FROM public.accounts WHERE id = r.account_id;

        -- 2. Extrair dias customizados do padrão "[Freq: every_X_days]" se presente na descrição
        BEGIN
            v_custom_days := NULL;
            IF r.description LIKE '%[Freq: every_%_days]%' THEN
                v_custom_days := substring(r.description from '\[Freq: every_([0-9]+)_days\]')::integer;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_custom_days := NULL;
        END;

        -- 3. Projetar ocorrências a partir da next_date atual até o fim do mês
        v_target_date := r.next_date;

        WHILE v_target_date <= v_limit_date LOOP
            -- Conta não-cartão de crédito com data no passado/presente nasce paga
            IF v_account_type != 'CREDIT_CARD' AND v_target_date <= CURRENT_DATE THEN
                v_is_paid := true;
            ELSE
                v_is_paid := false;
            END IF;

            -- Verificar se já existe a transação física na data específica
            SELECT EXISTS (
                SELECT 1 FROM public.transactions
                WHERE user_id = r.user_id
                  AND source_metadata->>'recurring_id' = r.id::text
                  AND date = v_target_date
            ) INTO v_exists;

            IF NOT v_exists THEN
                INSERT INTO public.transactions (
                    user_id, account_id, category_id, description,
                    amount_cents, transaction_type, date,
                    is_paid, source, source_metadata
                ) VALUES (
                    r.user_id, r.account_id, r.category_id, r.description,
                    r.amount_cents, r.transaction_type, v_target_date,
                    v_is_paid, 'RECURRING', jsonb_build_object('recurring_id', r.id)
                );
            ELSE
                -- Sincronizar descrição e dados de cadastro na transação existente
                UPDATE public.transactions
                SET description = r.description,
                    category_id = r.category_id,
                    account_id = r.account_id,
                    amount_cents = CASE WHEN is_paid = false THEN r.amount_cents ELSE amount_cents END,
                    is_paid = CASE WHEN v_is_paid THEN true ELSE is_paid END
                WHERE user_id = r.user_id
                  AND source_metadata->>'recurring_id' = r.id::text
                  AND date = v_target_date;
            END IF;

            -- Incrementar v_target_date com base na frequência
            IF v_custom_days IS NOT NULL THEN
                v_target_date := v_target_date + (v_custom_days || ' days')::interval;
            ELSIF r.frequency = 'daily' THEN
                v_target_date := v_target_date + interval '1 day';
            ELSIF r.frequency = 'weekly' THEN
                v_target_date := v_target_date + interval '7 days';
            ELSIF r.frequency = 'monthly' THEN
                v_target_date := v_target_date + interval '1 month';
            ELSIF r.frequency = 'yearly' THEN
                v_target_date := v_target_date + interval '1 year';
            ELSE
                -- Evita loop infinito
                v_target_date := v_target_date + interval '1 month';
            END IF;
        END LOOP;

        -- 4. Atualizar next_date da regra recorrente para o próximo vencimento no futuro
        IF v_target_date > r.next_date THEN
            UPDATE public.recurring_transactions
            SET next_date = v_target_date
            WHERE id = r.id;
        END IF;

    END LOOP;

    -- Atualização retroativa para marcar como pagas transações recorrentes passadas em contas não-cartão
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
