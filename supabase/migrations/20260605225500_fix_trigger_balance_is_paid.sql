-- ============================================================
-- Correção da Trigger de Atualização de Saldo de Conta
-- ============================================================
-- Altera a função para considerar o status 'is_paid'.
-- Transações pendentes (is_paid = false) não devem alterar o saldo.
-- Mudanças de status (pago <-> não pago) devem aplicar/estornar o saldo.

CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type TEXT;
  v_delta        BIGINT;
BEGIN

  -- ── BLOCO DELETE ─────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    SELECT type INTO v_account_type
      FROM public.accounts WHERE id = OLD.account_id;

    -- Cartões: saldo gerenciado pela fatura, não aqui
    IF v_account_type = 'CREDIT_CARD' THEN
      RETURN OLD;
    END IF;

    -- Só reverte o efeito se a transação estivesse paga
    IF OLD.is_paid = true THEN
      IF OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts
           SET balance_cents = balance_cents - OLD.amount_cents
         WHERE id = OLD.account_id;

      ELSIF OLD.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
        UPDATE public.accounts
           SET balance_cents = balance_cents + OLD.amount_cents
         WHERE id = OLD.account_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  -- ── BLOCO INSERT ─────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    SELECT type INTO v_account_type
      FROM public.accounts WHERE id = NEW.account_id;

    IF v_account_type = 'CREDIT_CARD' THEN
      RETURN NEW;
    END IF;

    -- Só altera saldo se a transação nascer paga
    IF NEW.is_paid = true THEN
      IF NEW.transaction_type = 'INCOME' THEN
        UPDATE public.accounts
           SET balance_cents = balance_cents + NEW.amount_cents
          WHERE id = NEW.account_id;

      ELSIF NEW.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
        UPDATE public.accounts
           SET balance_cents = balance_cents - NEW.amount_cents
          WHERE id = NEW.account_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ── BLOCO UPDATE ─────────────────────────────────────────
  IF TG_OP = 'UPDATE' THEN
    SELECT type INTO v_account_type
      FROM public.accounts WHERE id = NEW.account_id;

    IF v_account_type = 'CREDIT_CARD' THEN
      RETURN NEW;
    END IF;

    -- Se a conta mudou, reverter na antiga (se estava paga) e aplicar na nova (se está paga)
    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
      -- Reverter na antiga (se estava paga)
      SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
      IF v_account_type != 'CREDIT_CARD' AND OLD.is_paid = true THEN
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        ELSIF OLD.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
      END IF;

      -- Aplicar na nova (se está paga)
      SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
      IF v_account_type != 'CREDIT_CARD' AND NEW.is_paid = true THEN
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSIF NEW.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    -- Mesma conta: avaliar transição de is_paid e deltas
    IF OLD.is_paid = false AND NEW.is_paid = true THEN
      -- Passou de não pago para pago: aplicar valor total do NEW
      IF NEW.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
      ELSIF NEW.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
        UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
      END IF;

    ELSIF OLD.is_paid = true AND NEW.is_paid = false THEN
      -- Passou de pago para não pago (estorno): reverter valor total do OLD
      IF OLD.transaction_type = 'INCOME' THEN
        UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = NEW.account_id;
      ELSIF OLD.transaction_type IN ('EXPENSE', 'TRANSFER') THEN
        UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = NEW.account_id;
      END IF;

    ELSIF OLD.is_paid = true AND NEW.is_paid = true THEN
      -- Permaneceu pago: aplicar ajuste de delta
      IF NEW.transaction_type = 'INCOME' AND OLD.transaction_type = 'INCOME' THEN
        v_delta := NEW.amount_cents - OLD.amount_cents;
        UPDATE public.accounts SET balance_cents = balance_cents + v_delta WHERE id = NEW.account_id;

      ELSIF NEW.transaction_type IN ('EXPENSE','TRANSFER') AND OLD.transaction_type IN ('EXPENSE','TRANSFER') THEN
        v_delta := NEW.amount_cents - OLD.amount_cents;
        UPDATE public.accounts SET balance_cents = balance_cents - v_delta WHERE id = NEW.account_id;

      ELSE
        -- Tipo mudou (ex: EXPENSE virou INCOME)
        IF OLD.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents - OLD.amount_cents WHERE id = OLD.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents + OLD.amount_cents WHERE id = OLD.account_id;
        END IF;
        IF NEW.transaction_type = 'INCOME' THEN
          UPDATE public.accounts SET balance_cents = balance_cents + NEW.amount_cents WHERE id = NEW.account_id;
        ELSE
          UPDATE public.accounts SET balance_cents = balance_cents - NEW.amount_cents WHERE id = NEW.account_id;
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
