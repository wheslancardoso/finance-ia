-- Epic 4: A Máquina de SST (Reembolsos & Amortizações)
-- Adiciona chaves e flags para permitir reconciliação matemática sem dados fantasmas.

ALTER TABLE public.transactions
  ADD COLUMN linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN is_amortized BOOLEAN DEFAULT false;

-- Índices para performance em queries de reembolso
CREATE INDEX IF NOT EXISTS idx_transactions_linked_transaction_id ON public.transactions(linked_transaction_id);

-- Comentários nas colunas para fins de manutenção
COMMENT ON COLUMN public.transactions.linked_transaction_id IS 'ID de outra transação. Usado para vincular Receitas a Despesas (Reembolsos).';
COMMENT ON COLUMN public.transactions.is_amortized IS 'Flag que indica se esta parcela/transação foi antecipada/amortizada pelo usuário.';
