-- 1. Categorias Fantasmas (Shadow Categories)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS ignore_dashboard boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_reports boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_balance boolean DEFAULT false;

-- 2. Transações Divididas (Transaction Splits)
CREATE TABLE IF NOT EXISTS public.transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own transaction splits"
    ON public.transaction_splits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_splits.transaction_id
            AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transaction splits for their transactions"
    ON public.transaction_splits FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_id
            AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own transaction splits"
    ON public.transaction_splits FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_splits.transaction_id
            AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own transaction splits"
    ON public.transaction_splits FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_splits.transaction_id
            AND t.user_id = auth.uid()
        )
    );
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
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account,
                (SELECT COALESCE(json_agg(row_to_json(ts)), '[]'::json) FROM public.transaction_splits ts WHERE ts.transaction_id = t.id) as splits
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
                SELECT t.*, row_to_json(c) as category, row_to_json(a) as account,
                (SELECT COALESCE(json_agg(row_to_json(ts)), '[]'::json) FROM public.transaction_splits ts WHERE ts.transaction_id = t.id) as splits
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
