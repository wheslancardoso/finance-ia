-- ==========================================
-- Fechamento Automático de Faturas de Cartão
-- ==========================================
-- Cria função que fecha automaticamente faturas cujo closing_date já passou.
-- A inteligência do sistema garante:
--   1. Transações retroativas SEMPRE caem na fatura correta (pelo trigger existente trg_link_credit_card_transaction)
--   2. O valor da fatura SEMPRE recalcula automaticamente (pelo trigger existente trg_update_invoice_amount)
--   3. A fatura fecha no dia correto sem nenhuma intervenção manual

CREATE OR REPLACE FUNCTION fn_auto_close_invoices()
RETURNS void AS $$
BEGIN
  UPDATE credit_card_invoices
  SET status = 'CLOSED', updated_at = NOW()
  WHERE status = 'OPEN'
    AND closing_date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_auto_close_invoices TO anon, authenticated, service_role;
