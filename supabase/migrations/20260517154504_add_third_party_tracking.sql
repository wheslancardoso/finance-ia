-- Migration para habilitar controle de gastos de terceiros
ALTER TABLE public.transactions 
ADD COLUMN is_third_party BOOLEAN DEFAULT false,
ADD COLUMN third_party_name VARCHAR(255) DEFAULT NULL;
