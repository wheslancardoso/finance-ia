-- ==========================================
-- FASE 4: EVOLUTION & WHATSAPP INTEGRATION
-- FINAL INTEGRATED SCRIPT (v4)
-- ==========================================

-- 1. ADICIONAR COLUNA WHATSAPP AO GRUPO FAMILIAR
ALTER TABLE public.family_groups 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT UNIQUE;

-- 2. TABELA DE SESSÕES WHATSAPP (ESTADO DA IA)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    wa_id TEXT UNIQUE NOT NULL, -- Telefone do usuário
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    context_state JSONB DEFAULT '{}', -- Para guardar onde o usuário está no fluxo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. LOG DE MENSAGENS IA (TREINAMENTO E AUDITORIA)
CREATE TABLE IF NOT EXISTS public.ai_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user' ou 'ai'
    message TEXT NOT NULL,
    tokens_used INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ATUALIZAR RPC MESTRA (v3) PARA RETORNO INTEGRADO
-- Esta versão inclui: month_transactions, month_stats (com debit_expense), family_group info
-- e garante que faturas e recorrências venham completas.

CREATE OR REPLACE FUNCTION public.get_financial_state_v3(
    p_family_group_id UUID,
    p_target_month TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month_start TIMESTAMP WITH TIME ZONE;
    v_month_end TIMESTAMP WITH TIME ZONE;
    v_result JSONB;
BEGIN
    -- Definir limites do mês alvo
    v_month_start := date_trunc('month', p_target_month);
    v_month_end := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 second');

    SELECT jsonb_build_object(
        'family_group', (
            SELECT jsonb_build_object(
                'id', id,
                'name', name,
                'monthly_income_cents', COALESCE(monthly_income_cents, 0),
                'fixed_expenses_cents', COALESCE(fixed_expenses_cents, 0),
                'accumulated_balance_cents', COALESCE(accumulated_balance_cents, 0),
                'whatsapp_number', whatsapp_number
            )
            FROM public.family_groups
            WHERE id = p_family_group_id
        ),
        'categories', (
            SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
            FROM (
                SELECT id, name, type, icon_name, color_hex
                FROM public.categories
                WHERE family_group_id = p_family_group_id OR family_group_id IS NULL
                ORDER BY name ASC
            ) c
        ),
        'accounts', (
            SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
            FROM (
                SELECT * FROM public.accounts
                WHERE family_group_id = p_family_group_id
                ORDER BY name ASC
            ) a
        ),
        'invoices', (
            SELECT COALESCE(jsonb_agg(i), '[]'::jsonb)
            FROM (
                SELECT * FROM public.credit_card_invoices
                WHERE account_id IN (SELECT id FROM public.accounts WHERE family_group_id = p_family_group_id)
                AND (billing_month = to_char(v_month_start, 'YYYY-MM') OR billing_month = to_char(v_month_start - interval '1 month', 'YYYY-MM'))
            ) i
        ),
        'goals', (
            SELECT COALESCE(jsonb_agg(g), '[]'::jsonb)
            FROM (
                SELECT * FROM public.goals
                WHERE family_group_id = p_family_group_id
                ORDER BY deadline ASC NULLS LAST
            ) g
        ),
        'recurring_transactions', (
            SELECT COALESCE(jsonb_agg(rt_joined), '[]'::jsonb) FROM (
                SELECT rt.*, row_to_json(c) as category, row_to_json(acc) as account
                FROM public.recurring_transactions rt
                LEFT JOIN public.categories c ON rt.category_id = c.id
                LEFT JOIN public.accounts acc ON rt.account_id = acc.id
                WHERE rt.family_group_id = p_family_group_id
            ) rt_joined
        ),
        'budgets', (
            SELECT COALESCE(jsonb_agg(b), '[]'::jsonb)
            FROM (
                SELECT * FROM public.budgets
                WHERE family_group_id = p_family_group_id
            ) b
        ),
        'recent_transactions', (
            SELECT COALESCE(jsonb_agg(t_joined), '[]'::jsonb) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(acc) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts acc ON t.account_id = acc.id
                WHERE t.family_group_id = p_family_group_id
                ORDER BY t.date DESC, t.created_at DESC
                LIMIT 50
            ) t_joined
        ),
        'month_transactions', (
            SELECT COALESCE(jsonb_agg(t_joined), '[]'::jsonb) FROM (
                SELECT t.*, row_to_json(c) as category, row_to_json(acc) as account
                FROM public.transactions t
                LEFT JOIN public.categories c ON t.category_id = c.id
                LEFT JOIN public.accounts acc ON t.account_id = acc.id
                WHERE t.family_group_id = p_family_group_id
                AND t.date >= v_month_start AND t.date <= v_month_end
            ) t_joined
        ),
        'month_stats', (
            SELECT jsonb_build_object(
                'income', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'INCOME'), 0),
                'expense', COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'EXPENSE'), 0),
                'debit_expense', COALESCE(SUM(amount_cents) FILTER (
                    WHERE transaction_type = 'EXPENSE' 
                    AND account_id IN (SELECT id FROM public.accounts WHERE type != 'CREDIT_CARD')
                ), 0)
            )
            FROM public.transactions
            WHERE family_group_id = p_family_group_id
            AND date >= v_month_start AND date <= v_month_end
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 5. ÍNDICES PARA PERFORMANCE WHATSAPP
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_wa_id ON public.whatsapp_sessions(wa_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_log_family ON public.ai_message_log(family_group_id);
