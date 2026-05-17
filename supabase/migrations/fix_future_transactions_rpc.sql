-- ========================================================
-- 🌌 VESPER FINANCE — RPC FUTURE TRANSACTIONS FIX
-- ========================================================
-- Adiciona a chave 'future_transactions' na RPC get_financial_state_v5.

BEGIN;

DROP FUNCTION IF EXISTS public.get_financial_state_v5(uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_financial_state_v5(uuid);

CREATE OR REPLACE FUNCTION public.get_financial_state_v5(
    p_user_id UUID, 
    p_target_month TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_family_group_id UUID;
    v_month_start DATE := date_trunc('month', p_target_month)::date;
    v_month_end DATE := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 day')::date;
BEGIN
    -- Obter o family_group_id do profile do usuário
    SELECT family_group_id INTO v_family_group_id FROM public.profiles WHERE id = p_user_id;

    -- Se não encontrar (usuário sem grupo de família ou usando ID do grupo diretamente)
    IF v_family_group_id IS NULL THEN
        v_family_group_id := p_user_id;
    END IF;

    SELECT json_build_object(
        'family_group', (
            SELECT row_to_json(fg) FROM public.family_groups fg WHERE id = v_family_group_id
        ),
        'user_profile', (
            SELECT json_build_object(
                'monthly_income_cents', COALESCE(monthly_income_cents, 0),
                'fixed_expenses_cents', COALESCE(fixed_expenses_cents, 0),
                'accumulated_balance_cents', COALESCE(
                    (SELECT SUM(balance_cents) FROM public.accounts WHERE family_group_id = v_family_group_id AND is_active = true), 
                    0
                ),
                'financial_health_score', COALESCE(financial_health_score, 80)
            )
            FROM public.profiles WHERE id = p_user_id
        ),
        'accounts', (
            SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json) FROM public.accounts a 
            WHERE family_group_id = v_family_group_id AND is_active = true
        ),
        'invoices', (
            SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM public.credit_card_invoices i 
            JOIN public.accounts a ON i.account_id = a.id 
            WHERE a.family_group_id = v_family_group_id AND i.status != 'PAID'
        ),
        'goals', (
            SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json) FROM public.goals g 
            WHERE family_group_id = v_family_group_id AND status = 'active'
        ),
        'recurring_transactions', (
            SELECT COALESCE(json_agg(rt_joined), '[]'::json) FROM (
                SELECT rt.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.recurring_transactions rt
                LEFT JOIN public.categories c ON rt.category_id = c.id
                LEFT JOIN public.accounts a ON rt.account_id = a.id
                WHERE rt.family_group_id = v_family_group_id AND rt.status = 'active'
            ) rt_joined
        ),
        'budgets', (
            SELECT COALESCE(json_agg(row_to_json(b)), '[]'::json) FROM public.budgets b 
            WHERE family_group_id = v_family_group_id
        ),
        'recent_transactions', (
            SELECT COALESCE(json_agg(t_joined), '[]'::json) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = v_family_group_id
                ORDER BY t.date DESC
                LIMIT 50
            ) t_joined
        ),
        'month_transactions', (
            SELECT COALESCE(json_agg(t_joined), '[]'::json) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = v_family_group_id
                AND t.date >= v_month_start AND t.date <= v_month_end
                ORDER BY t.date DESC
            ) t_joined
        ),
        'future_transactions', (
            SELECT COALESCE(json_agg(t_joined), '[]'::json) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = v_family_group_id
                AND t.date > v_month_end
                ORDER BY t.date ASC
            ) t_joined
        ),
        'month_stats', (
            SELECT json_build_object(
                'income', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'INCOME'), 0),
                'expense', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'EXPENSE'), 0),
                'debit_expense', COALESCE(SUM(amount_cents) FILTER (
                    WHERE transaction_type = 'EXPENSE' 
                    AND account_id IN (SELECT id FROM public.accounts WHERE family_group_id = v_family_group_id AND type != 'CREDIT_CARD')
                ), 0)
            )
            FROM public.transactions
            WHERE family_group_id = v_family_group_id 
            AND date >= v_month_start AND date <= v_month_end
            AND is_paid = true
        ),
        'categories', (
            SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM public.categories c 
            WHERE family_group_id = v_family_group_id OR is_system_default = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_financial_state_v5(uuid, timestamp with time zone) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_state_v5(uuid) TO anon, authenticated, service_role;

COMMIT;
