-- Migration Epic 3: Juros, Multas e Descontos
-- Adiciona colunas para registrar detalhes contábeis da transação

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS interest_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_cents BIGINT DEFAULT 0;

-- Comment on columns for clarity
COMMENT ON COLUMN public.transactions.amount_cents IS 'O valor final real que saiu/entrou na conta bancária (incluindo juros e subtraindo descontos).';
COMMENT ON COLUMN public.transactions.interest_cents IS 'Opcional: Valor pago/recebido em juros e multas de atraso (já incluso no amount_cents).';
COMMENT ON COLUMN public.transactions.discount_cents IS 'Opcional: Valor que foi descontado do valor original (para fins informativos).';
