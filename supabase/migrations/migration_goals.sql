-- Migração para Sistema de Metas (Vesper Goals)

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount_cents BIGINT NOT NULL CHECK (target_amount_cents > 0),
    current_amount_cents BIGINT NOT NULL DEFAULT 0,
    deadline DATE,
    color_hex TEXT DEFAULT '#8B5CF6',
    icon_name TEXT DEFAULT 'Target',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view goals of their family group" ON goals
    FOR SELECT USING (
        family_group_id IN (
            SELECT family_group_id FROM family_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage goals of their family group" ON goals
    FOR ALL USING (
        family_group_id IN (
            SELECT family_group_id FROM family_members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Seed de teste para metas
DO $$ 
DECLARE
    v_group_id UUID;
BEGIN
    SELECT id INTO v_group_id FROM family_groups LIMIT 1;
    
    IF v_group_id IS NOT NULL THEN
        INSERT INTO goals (family_group_id, name, target_amount_cents, current_amount_cents, deadline, color_hex, icon_name)
        VALUES 
        (v_group_id, 'Reserva de Emergência', 1000000, 350000, now() + interval '6 months', '#10B981', 'ShieldCheck'),
        (v_group_id, 'Viagem para o Japão', 2500000, 120000, now() + interval '1 year', '#F87171', 'Plane')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
