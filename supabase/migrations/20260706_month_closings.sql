-- Migration: month_closings
-- Cada mês é uma "caixinha" selada com o estado financeiro final.
-- Fonte de verdade absoluta para meses passados.

CREATE TABLE IF NOT EXISTS public.month_closings (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month         VARCHAR(7) NOT NULL,  -- 'YYYY-MM'
  
  -- Saldo consolidado de todas as contas correntes no último dia do mês
  total_balance_cents     BIGINT NOT NULL DEFAULT 0,
  
  -- Breakdown por conta (JSONB para flexibilidade)
  -- Ex: [{"account_id": "...", "name": "NuConta", "balance_cents": 13900}]
  account_balances        JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Resumo do mês
  total_income_cents      BIGINT NOT NULL DEFAULT 0,
  total_expenses_cents    BIGINT NOT NULL DEFAULT 0,
  total_credit_debt_cents BIGINT NOT NULL DEFAULT 0,
  
  -- Metadata
  sealed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seal_method             TEXT NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual' | 'reconciliation'
  
  UNIQUE(user_id, reference_month)
);

-- RLS
ALTER TABLE public.month_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own closings" ON public.month_closings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own closings" ON public.month_closings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own closings" ON public.month_closings
  FOR UPDATE USING (auth.uid() = user_id);
