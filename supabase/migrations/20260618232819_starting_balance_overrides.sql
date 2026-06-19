CREATE TABLE IF NOT EXISTS public.monthly_balance_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    month_key VARCHAR(7) NOT NULL, -- format 'YYYY-MM'
    balance_cents BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month_key)
);

-- Habilitar RLS
ALTER TABLE public.monthly_balance_overrides ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Usuários gerenciam seus próprios overrides" ON public.monthly_balance_overrides
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_monthly_balance_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monthly_balance_overrides_updated_at ON public.monthly_balance_overrides;
CREATE TRIGGER update_monthly_balance_overrides_updated_at
BEFORE UPDATE ON public.monthly_balance_overrides
FOR EACH ROW
EXECUTE FUNCTION update_monthly_balance_overrides_updated_at();
