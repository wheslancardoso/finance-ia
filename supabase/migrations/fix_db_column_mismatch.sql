-- SCRIPT DE CORREÇÃO: Inconsistência de colunas em credit_card_invoices
-- Este script resolve o erro 'column "total_amount_cents" of relation "credit_card_invoices" does not exist'

DO $$ 
BEGIN
  -- 1. Garantir que a coluna correta exista
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='amount_cents') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_invoices' AND column_name='total_amount_cents') THEN
      ALTER TABLE public.credit_card_invoices RENAME COLUMN total_amount_cents TO amount_cents;
    ELSE
      ALTER TABLE public.credit_card_invoices ADD COLUMN amount_cents BIGINT DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 2. Atualizar a função de sincronização da fatura
CREATE OR REPLACE FUNCTION public.fn_sync_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  -- DELETE: só existe OLD, não NEW
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN
      UPDATE public.credit_card_invoices
         SET amount_cents = COALESCE((
               SELECT SUM(amount_cents) FROM public.transactions
               WHERE invoice_id = OLD.invoice_id
             ), 0)
       WHERE id = OLD.invoice_id;
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT ou UPDATE: atualiza fatura nova
  IF NEW.invoice_id IS NOT NULL THEN
    UPDATE public.credit_card_invoices
       SET amount_cents = COALESCE((
             SELECT SUM(amount_cents) FROM public.transactions
             WHERE invoice_id = NEW.invoice_id
           ), 0)
     WHERE id = NEW.invoice_id;
  END IF;

  -- UPDATE: se mudou de fatura, atualiza a antiga também
  IF TG_OP = 'UPDATE'
     AND OLD.invoice_id IS NOT NULL
     AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    UPDATE public.credit_card_invoices
       SET amount_cents = COALESCE((
             SELECT SUM(amount_cents) FROM public.transactions
             WHERE invoice_id = OLD.invoice_id
           ), 0)
     WHERE id = OLD.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Corrigir funções que consultam as métricas do Modo Crise (se existirem)
-- Buscamos funções que possam estar usando o nome antigo
CREATE OR REPLACE FUNCTION public.fn_get_crisis_mode_metrics(p_family_group_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_liquid         BIGINT;
  v_credit_debt    BIGINT;
  v_income         BIGINT;
  v_committed      BIGINT;
  v_free_cash      BIGINT;
  v_days_remaining INTEGER;
  v_daily_safe     BIGINT;
  v_month_end      DATE := (date_trunc('month', NOW()) + interval '1 month - 1 day')::date;
BEGIN
  SELECT COALESCE(SUM(balance_cents), 0) INTO v_liquid
    FROM public.accounts
   WHERE family_group_id = p_family_group_id
     AND type != 'CREDIT_CARD'
     AND is_active = true;

  -- CORREÇÃO AQUI: total_amount_cents -> amount_cents
  SELECT COALESCE(SUM(i.amount_cents), 0) INTO v_credit_debt
    FROM public.credit_card_invoices i
    JOIN public.accounts a ON i.account_id = a.id
   WHERE a.family_group_id = p_family_group_id
     AND i.status IN ('OPEN', 'CLOSED');

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_income
    FROM public.recurring_transactions
   WHERE family_group_id = p_family_group_id
     AND transaction_type = 'INCOME'
     AND status = 'active';

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_committed
    FROM public.recurring_transactions
   WHERE family_group_id = p_family_group_id
     AND transaction_type = 'EXPENSE'
     AND status = 'active';

  v_free_cash := v_liquid - v_credit_debt;
  v_days_remaining := EXTRACT(DAY FROM (v_month_end - NOW()::date)) + 1;
  
  IF v_days_remaining > 0 THEN
    v_daily_safe := (v_free_cash + v_income - v_committed) / v_days_remaining;
  ELSE
    v_daily_safe := 0;
  END IF;

  RETURN jsonb_build_object(
    'liquid_balance', v_liquid,
    'credit_debt', v_credit_debt,
    'free_cash', v_free_cash,
    'daily_safe_spend', v_daily_safe,
    'days_remaining', v_days_remaining
  );
END;
$$ LANGUAGE plpgsql;
