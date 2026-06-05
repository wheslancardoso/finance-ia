-- Migração: Suporte a transações de reajuste (INCOME) em faturas de cartão de crédito
-- Modifica a função trg_update_invoice_amount para subtrair INCOME (receitas/estornos/créditos) do total da fatura.

CREATE OR REPLACE FUNCTION public.trg_update_invoice_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar a fatura antiga (se mudou de fatura ou se foi deletado)
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.invoice_id IS NOT NULL THEN
            UPDATE public.credit_card_invoices
            SET amount_cents = (
                SELECT COALESCE(
                    SUM(
                        CASE 
                            WHEN transaction_type = 'INCOME' THEN -amount_cents 
                            ELSE amount_cents 
                        END
                    ), 0
                ) 
                FROM public.transactions 
                WHERE invoice_id = OLD.invoice_id AND transaction_type != 'PAYMENT'
            )
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;

    -- Atualizar a fatura nova (se inseriu ou atualizou)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE public.credit_card_invoices
            SET amount_cents = (
                SELECT COALESCE(
                    SUM(
                        CASE 
                            WHEN transaction_type = 'INCOME' THEN -amount_cents 
                            ELSE amount_cents 
                        END
                    ), 0
                ) 
                FROM public.transactions 
                WHERE invoice_id = NEW.invoice_id AND transaction_type != 'PAYMENT'
            )
            WHERE id = NEW.invoice_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
