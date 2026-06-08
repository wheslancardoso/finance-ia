
-- ==========================================
-- 🌌 VESPER FINANCE — CONSOLIDADO V6 (ULTRA FIX)
-- ==========================================
-- Este script força a recriação de todas as RPCs e garante permissões.
-- Execute no SQL Editor do Supabase.

BEGIN;

-- 0. Limpeza Geral (Evita conflitos de assinatura)
DROP FUNCTION IF EXISTS public.get_financial_state_v5(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_financial_state_v5(UUID);
DROP FUNCTION IF EXISTS public.fn_get_goal_recommendations(UUID);
DROP FUNCTION IF EXISTS public.fn_simulate_spending(UUID, BIGINT);
DROP FUNCTION IF EXISTS public.get_month_projection(UUID, DATE);
DROP FUNCTION IF EXISTS public.create_transfer(UUID, UUID, UUID, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.create_installment_series(UUID, TEXT, BIGINT, INTEGER, UUID, UUID, TIMESTAMPTZ);

-- 1. get_month_projection
CREATE OR REPLACE FUNCTION public.get_month_projection(
    p_family_group_id UUID, 
    p_target_month DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_month_start DATE := date_trunc('month', p_target_month)::date;
    v_month_end DATE := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 day')::date;
    v_income_total BIGINT;
    v_expense_total BIGINT;
    v_balance_current BIGINT;
    v_projected_balance BIGINT;
BEGIN
    SELECT COALESCE(SUM(balance_cents), 0) INTO v_balance_current
    FROM public.accounts
    WHERE family_group_id = p_family_group_id AND type != 'CREDIT_CARD' AND is_active = true;

    SELECT COALESCE(SUM(amount_cents), 0) INTO v_income_total
    FROM public.transactions
    WHERE family_group_id = p_family_group_id 
    AND date >= v_month_start AND date <= v_month_end
    AND transaction_type = 'INCOME';

    SELECT COALESCE(SUM(amount_cents), 0) INTO v_expense_total
    FROM public.transactions
    WHERE family_group_id = p_family_group_id 
    AND date >= v_month_start AND date <= v_month_end
    AND transaction_type = 'EXPENSE'
    AND account_id IN (SELECT id FROM public.accounts WHERE family_group_id = p_family_group_id AND type != 'CREDIT_CARD');

    v_projected_balance := v_balance_current + v_income_total - v_expense_total;

    RETURN json_build_object(
        'projection', json_build_object(
            'month_start', v_month_start,
            'month_end', v_month_end,
            'current_balance_cents', v_balance_current,
            'projected_income_cents', v_income_total,
            'projected_expense_cents', v_expense_total,
            'projected_end_balance_cents', v_projected_balance
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. get_financial_state_v5
CREATE OR REPLACE FUNCTION public.get_financial_state_v5(
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
        'family_group', (
            SELECT row_to_json(fg) FROM public.family_groups fg WHERE id = p_family_group_id
        ),
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
                WHERE rt.family_group_id = p_family_group_id
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
        'month_transactions', (
            SELECT COALESCE(json_agg(t_joined), '[]'::json) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts a ON t.account_id = a.id
                WHERE t.family_group_id = p_family_group_id
                AND t.date >= v_month_start AND t.date <= v_month_end
                ORDER BY t.date DESC
            ) t_joined
        ),
        'month_stats', (
            SELECT json_build_object(
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
            SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM public.categories c 
            WHERE family_group_id = p_family_group_id OR is_system_default = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. fn_get_goal_recommendations
CREATE OR REPLACE FUNCTION public.fn_get_goal_recommendations(
  p_family_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projection JSONB;
  v_surplus BIGINT;
  v_goal RECORD;
  v_recommendations JSONB := '[]'::jsonb;
  v_amount_to_allocate BIGINT;
  v_remaining_surplus BIGINT;
BEGIN
  v_projection := public.get_month_projection(p_family_group_id, CURRENT_DATE);
  v_surplus := (v_projection->'projection'->>'projected_end_balance_cents')::bigint;
  v_remaining_surplus := COALESCE(v_surplus, 0);

  IF v_remaining_surplus <= 0 THEN
    RETURN jsonb_build_object(
      'surplus_cents', v_surplus,
      'recommendations', v_recommendations,
      'message', 'Sem sobra livre projetada para este mês.'
    );
  END IF;

  FOR v_goal IN (
    SELECT id, name, target_amount_cents, current_amount_cents, monthly_contribution_cents, priority
    FROM public.goals
    WHERE family_group_id = p_family_group_id
      AND status = 'active'
      AND current_amount_cents < target_amount_cents
    ORDER BY COALESCE(priority, 999) ASC, created_at ASC
  ) LOOP
    v_amount_to_allocate := COALESCE(v_goal.monthly_contribution_cents, 0);
    IF v_remaining_surplus < v_amount_to_allocate THEN v_amount_to_allocate := v_remaining_surplus; END IF;
    IF v_amount_to_allocate > 0 THEN
      v_recommendations := v_recommendations || jsonb_build_object(
        'goal_id', v_goal.id,
        'goal_name', v_goal.name,
        'recommended_amount_cents', v_amount_to_allocate,
        'is_full_target', v_amount_to_allocate = v_goal.monthly_contribution_cents
      );
      v_remaining_surplus := v_remaining_surplus - v_amount_to_allocate;
    END IF;
    EXIT WHEN v_remaining_surplus <= 0;
  END LOOP;

  RETURN jsonb_build_object(
    'surplus_cents', v_surplus,
    'remaining_surplus_cents', v_remaining_surplus,
    'recommendations', v_recommendations
  );
END;
$$;

-- 4. fn_simulate_spending
CREATE OR REPLACE FUNCTION public.fn_simulate_spending(
  p_family_group_id UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projection JSONB;
  v_current_surplus BIGINT;
  v_new_surplus BIGINT;
  v_status TEXT;
  v_message TEXT;
BEGIN
  v_projection := public.get_month_projection(p_family_group_id, CURRENT_DATE);
  v_current_surplus := (v_projection->'projection'->>'projected_end_balance_cents')::bigint;
  v_new_surplus := COALESCE(v_current_surplus, 0) - p_amount_cents;

  IF v_new_surplus < 0 THEN
    v_status := 'DANGER';
    v_message := 'Este gasto deixará seu saldo negativo no fim do mês!';
  ELSIF v_new_surplus < (COALESCE(v_current_surplus, 0) * 0.2) THEN
    v_status := 'WARNING';
    v_message := 'Cuidado, este gasto consome quase toda sua sobra livre.';
  ELSE
    v_status := 'SAFE';
    v_message := 'Gasto dentro da margem de segurança.';
  END IF;

  RETURN jsonb_build_object(
    'current_surplus_cents', v_current_surplus,
    'simulated_surplus_cents', v_new_surplus,
    'status', v_status,
    'message', v_message,
    'impact_percentage', CASE WHEN COALESCE(v_current_surplus, 0) > 0 THEN ROUND((p_amount_cents::numeric / v_current_surplus::numeric) * 100, 2) ELSE 100 END
  );
END;
$$;

-- Permissões Universais (Grant para anon e authenticated)
GRANT EXECUTE ON FUNCTION public.get_month_projection TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_state_v5 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_goal_recommendations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_simulate_spending TO anon, authenticated, service_role;

COMMIT;

-- Verificação final (Execute isto para confirmar)
SELECT n.nspname as schema_name, p.proname, p.pronargs, p.prosecdef 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_financial_state_v5', 'fn_get_goal_recommendations', 'fn_simulate_spending');
