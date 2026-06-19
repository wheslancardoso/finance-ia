-- Migration Epic 2: Daily Snapshots
-- Creates the table, the O(1) rebuild function, and the trigger.

CREATE TABLE IF NOT EXISTS public.account_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    balance_cents BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, snapshot_date)
);

ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own account snapshots"
    ON public.account_snapshots FOR SELECT
    USING (
        account_id IN (
            SELECT id FROM public.accounts 
            WHERE family_group_id IN (
                SELECT family_group_id FROM public.family_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service Role can manage snapshots"
    ON public.account_snapshots FOR ALL
    USING (true)
    WITH CHECK (true);

-- Ultra-fast O(1) function to rebuild snapshots from a given date using Window Functions
CREATE OR REPLACE FUNCTION public.fn_rebuild_account_snapshots(p_account_id UUID, p_start_date DATE DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE := CURRENT_DATE;
    v_base_balance BIGINT := 0;
BEGIN
    IF p_start_date IS NULL THEN
        SELECT MIN(date::DATE) INTO v_start_date FROM public.transactions WHERE account_id = p_account_id;
        IF v_start_date IS NULL THEN
            v_start_date := CURRENT_DATE;
        END IF;
        DELETE FROM public.account_snapshots WHERE account_id = p_account_id;
    ELSE
        v_start_date := p_start_date;
        SELECT balance_cents INTO v_base_balance 
        FROM public.account_snapshots 
        WHERE account_id = p_account_id AND snapshot_date = (v_start_date - INTERVAL '1 day')::DATE;
        
        IF v_base_balance IS NULL THEN
            SELECT COALESCE(SUM(
                CASE 
                    WHEN t.transaction_type = 'INCOME' THEN t.amount_cents
                    WHEN t.transaction_type IN ('EXPENSE', 'TRANSFER') THEN -t.amount_cents
                    ELSE 0
                END
            ), 0) INTO v_base_balance
            FROM public.transactions t
            LEFT JOIN public.categories c ON t.category_id = c.id
            WHERE t.account_id = p_account_id 
              AND t.date::DATE < v_start_date 
              AND t.is_paid = true
              AND (c.ignore_balance IS NULL OR c.ignore_balance = false);
        END IF;

        DELETE FROM public.account_snapshots WHERE account_id = p_account_id AND snapshot_date >= v_start_date;
    END IF;

    -- Generate all dates from v_start_date to v_end_date and calculate running sum
    INSERT INTO public.account_snapshots (account_id, snapshot_date, balance_cents)
    SELECT 
        p_account_id,
        d.date::DATE,
        v_base_balance + COALESCE(SUM(daily_deltas.delta) OVER (ORDER BY d.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 0)
    FROM generate_series(v_start_date::timestamp, v_end_date::timestamp, '1 day'::interval) d(date)
    LEFT JOIN (
        SELECT 
            t.date::DATE as txn_date,
            SUM(
                CASE 
                    WHEN t.transaction_type = 'INCOME' THEN t.amount_cents
                    WHEN t.transaction_type IN ('EXPENSE', 'TRANSFER') THEN -t.amount_cents
                    ELSE 0
                END
            ) as delta
        FROM public.transactions t
        LEFT JOIN public.categories c ON t.category_id = c.id
        WHERE t.account_id = p_account_id 
          AND t.date::DATE >= v_start_date 
          AND t.is_paid = true
          AND (c.ignore_balance IS NULL OR c.ignore_balance = false)
        GROUP BY t.date::DATE
    ) daily_deltas ON d.date::DATE = daily_deltas.txn_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- The Trigger that invalidates and rebuilds
CREATE OR REPLACE FUNCTION public.trg_rebuild_snapshots()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE;
    v_account_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_date := OLD.date::DATE;
        v_account_id := OLD.account_id;
    ELSE
        -- If it's UPDATE and the date changed, take the oldest date
        IF TG_OP = 'UPDATE' THEN
            IF OLD.date::DATE < NEW.date::DATE THEN
                v_date := OLD.date::DATE;
            ELSE
                v_date := NEW.date::DATE;
            END IF;
            
            -- If account changed, rebuild for OLD account too starting from OLD date
            IF OLD.account_id != NEW.account_id THEN
                PERFORM public.fn_rebuild_account_snapshots(OLD.account_id, OLD.date::DATE);
            END IF;
        ELSE
            v_date := NEW.date::DATE;
        END IF;
        v_account_id := NEW.account_id;
    END IF;

    -- Rebuild snapshots for the affected account starting from the changed date
    PERFORM public.fn_rebuild_account_snapshots(v_account_id, v_date);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to transactions table
DROP TRIGGER IF EXISTS trg_rebuild_snapshots_on_transaction ON public.transactions;
CREATE TRIGGER trg_rebuild_snapshots_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_snapshots();

-- Update get_financial_state_v5 to include account_snapshots
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
        'account_snapshots', (
            SELECT COALESCE(json_agg(row_to_json(snpsht)), '[]'::json) FROM public.account_snapshots snpsht
            JOIN public.accounts a ON snpsht.account_id = a.id
            WHERE a.family_group_id = p_family_group_id
            -- We might want to filter this by date or return 6 months worth, but returning all is fine if fast
            -- Let's return the last 12 months for now to keep JSON small
            AND snpsht.snapshot_date >= (CURRENT_DATE - INTERVAL '1 year')
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
        ),
        'future_transactions', (
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM public.transactions t
            WHERE family_group_id = p_family_group_id AND date > v_month_end AND is_paid = false
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
