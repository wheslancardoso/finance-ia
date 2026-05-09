-- ==========================================
-- 🚀 FASE 3/4: DATABASE-DRIVEN ARCHITECTURE
-- ==========================================
-- Execute este script no SQL Editor do seu Supabase.

-- 1. Criação das novas tabelas e colunas
CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  billing_month character varying NOT NULL, -- Ex: '2026-05'
  closing_date date NOT NULL,
  due_date date NOT NULL,
  status character varying DEFAULT 'OPEN'::character varying CHECK (status IN ('OPEN', 'CLOSED', 'PAID')),
  total_amount_cents bigint DEFAULT 0,
  paid_amount_cents bigint DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT credit_card_invoices_pkey PRIMARY KEY (id),
  CONSTRAINT credit_card_invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE
);

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.credit_card_invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

-- 2. Trigger para Atualização de Saldo de Contas Correntes
-- Garante que o balance_cents em accounts sempre reflita a realidade
CREATE OR REPLACE FUNCTION tg_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type varchar;
BEGIN
  -- Na deleção
  IF TG_OP = 'DELETE' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
    IF v_account_type != 'CREDIT_CARD' AND OLD.is_paid = true THEN
      IF OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
      ELSIF OLD.transaction_type = 'EXPENSE' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- Na inserção
  IF TG_OP = 'INSERT' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    IF v_account_type != 'CREDIT_CARD' AND NEW.is_paid = true THEN
      IF NEW.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
      ELSIF NEW.transaction_type = 'EXPENSE' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Na atualização
  IF TG_OP = 'UPDATE' THEN
    SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
    IF v_account_type != 'CREDIT_CARD' THEN
      -- Reverter antigo se estava pago
      IF OLD.is_paid = true THEN
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        ELSIF OLD.transaction_type = 'EXPENSE' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
      END IF;
      
      -- Aplicar novo se está pago
      IF NEW.is_paid = true THEN
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSIF NEW.transaction_type = 'EXPENSE' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_account_balance_trigger ON public.transactions;
CREATE TRIGGER update_account_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION tg_update_account_balance();

-- 3. Trigger para Progresso de Metas
CREATE OR REPLACE FUNCTION tg_update_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.goal_id IS NOT NULL AND OLD.is_paid = true THEN
      UPDATE public.goals SET current_amount_cents = current_amount_cents - OLD.amount_cents WHERE id = OLD.goal_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.goal_id IS NOT NULL AND NEW.is_paid = true THEN
      UPDATE public.goals SET current_amount_cents = current_amount_cents + NEW.amount_cents WHERE id = NEW.goal_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Reverter old
    IF OLD.goal_id IS NOT NULL AND OLD.is_paid = true THEN
      UPDATE public.goals SET current_amount_cents = current_amount_cents - OLD.amount_cents WHERE id = OLD.goal_id;
    END IF;
    -- Aplicar new
    IF NEW.goal_id IS NOT NULL AND NEW.is_paid = true THEN
      UPDATE public.goals SET current_amount_cents = current_amount_cents + NEW.amount_cents WHERE id = NEW.goal_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_goal_progress_trigger ON public.transactions;
CREATE TRIGGER update_goal_progress_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION tg_update_goal_progress();


-- 4. Função Mestra de Estado Global & Lazy Materialization de Recorrências
CREATE OR REPLACE FUNCTION get_financial_state(p_family_group_id uuid, p_target_month date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_rec record;
  v_month_start timestamp;
  v_month_end timestamp;
BEGIN
  -- Definir limites do mês para busca de transações e métricas
  v_month_start := date_trunc('month', p_target_month);
  v_month_end := (date_trunc('month', p_target_month) + interval '1 month' - interval '1 second');

  -- Lazy Materialization: Gera as transações recorrentes vencidas que ainda não foram criadas
  FOR v_rec IN 
    SELECT * FROM public.recurring_transactions 
    WHERE family_group_id = p_family_group_id AND status = 'active' AND next_date <= CURRENT_DATE
  LOOP
    -- Insere a transação pendente (is_paid = false)
    INSERT INTO public.transactions (
      account_id, category_id, amount_cents, transaction_type, date, description, source
    ) VALUES (
      v_rec.account_id, v_rec.category_id, v_rec.amount_cents, v_rec.transaction_type, v_rec.next_date, v_rec.description, 'RECURRING'
    );
    
    -- Atualiza a data da próxima recorrência baseada na frequência
    UPDATE public.recurring_transactions 
    SET next_date = 
      CASE 
        WHEN frequency = 'daily' THEN next_date + INTERVAL '1 day'
        WHEN frequency = 'weekly' THEN next_date + INTERVAL '1 week'
        WHEN frequency = 'monthly' THEN next_date + INTERVAL '1 month'
        WHEN frequency = 'yearly' THEN next_date + INTERVAL '1 year'
        ELSE next_date
      END
    WHERE id = v_rec.id;
  END LOOP;

  -- Agrega todo o estado financeiro num único JSON
  SELECT json_build_object(
    'family_group', (
      SELECT row_to_json(fg) FROM public.family_groups fg WHERE id = p_family_group_id
    ),
    'categories', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM public.categories c 
      WHERE family_group_id = p_family_group_id OR family_group_id IS NULL
    ),
    'accounts', (
      SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json) FROM public.accounts a 
      WHERE family_group_id = p_family_group_id
    ),
    'invoices', (
      SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM public.credit_card_invoices i 
      JOIN public.accounts a ON i.account_id = a.id 
      WHERE a.family_group_id = p_family_group_id
    ),
    'goals', (
      SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json) FROM public.goals g 
      WHERE family_group_id = p_family_group_id
    ),
    'recurring_transactions', (
      SELECT COALESCE(json_agg(rt_joined), '[]'::json) FROM (
        SELECT 
          rt.*,
          row_to_json(c) as category,
          row_to_json(a) as account
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
        SELECT 
          t.*,
          row_to_json(c) as category,
          row_to_json(a) as account
        FROM public.transactions t
        LEFT JOIN public.categories c ON t.category_id = c.id
        LEFT JOIN public.accounts a ON t.account_id = a.id
        WHERE t.account_id IN (SELECT id FROM public.accounts WHERE family_group_id = p_family_group_id)
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 50
      ) t_joined
    ),
    'month_transactions', (
      SELECT COALESCE(json_agg(mt_joined), '[]'::json) FROM (
        SELECT 
          t.*,
          row_to_json(c) as category,
          row_to_json(a) as account
        FROM public.transactions t
        LEFT JOIN public.categories c ON t.category_id = c.id
        LEFT JOIN public.accounts a ON t.account_id = a.id
        WHERE t.account_id IN (SELECT id FROM public.accounts WHERE family_group_id = p_family_group_id)
        AND t.date >= v_month_start AND t.date <= v_month_end
      ) mt_joined
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
