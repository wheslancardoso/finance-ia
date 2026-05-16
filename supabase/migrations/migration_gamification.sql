-- MIGRATION: Gamificação Brutalista - Perfil de Resiliência Financeira e Streaks
-- Objetivo: Criar a tabela de gamificação, habilitar RLS com políticas de isolamento e trigger automatizada para criação de perfil.

BEGIN;

-- 1. Criar a tabela de Perfil de Gamificação do Usuário
CREATE TABLE IF NOT EXISTS public.user_gamification_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resilience_points INTEGER DEFAULT 0 NOT NULL CHECK (resilience_points >= 0),
    current_streak INTEGER DEFAULT 0 NOT NULL CHECK (current_streak >= 0),
    max_streak INTEGER DEFAULT 0 NOT NULL CHECK (max_streak >= 0),
    active_theme VARCHAR(50) DEFAULT 'brutalist-dark' NOT NULL,
    unlocked_achievements JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_gamification_profile UNIQUE (user_id)
);

-- 2. Habilitar RLS (Row Level Security) na tabela
ALTER TABLE public.user_gamification_profile ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Isolamento e Segurança RLS
DROP POLICY IF EXISTS "Users can manage their own gamification profile" ON public.user_gamification_profile;
CREATE POLICY "Users can manage their own gamification profile" ON public.user_gamification_profile
    FOR ALL USING (user_id = auth.uid());

-- 4. Função e Trigger para criação automatizada de perfil em novas contas
CREATE OR REPLACE FUNCTION public.create_gamification_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_gamification_profile (user_id, resilience_points, current_streak, max_streak, active_theme, unlocked_achievements)
    VALUES (NEW.id, 0, 0, 0, 'brutalist-dark', '[]'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_gamification_profile_on_new_profile ON public.profiles;
CREATE TRIGGER trigger_create_gamification_profile_on_new_profile
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_gamification_profile_for_new_user();

-- 5. Popular perfis existentes que ainda não possuem perfil de gamificação
INSERT INTO public.user_gamification_profile (user_id, resilience_points, current_streak, max_streak, active_theme, unlocked_achievements)
SELECT id, 0, 0, 0, 'brutalist-dark', '[]'::jsonb
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 6. Trigger para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at_gamification ON public.user_gamification_profile;
CREATE TRIGGER handle_updated_at_gamification
    BEFORE UPDATE ON public.user_gamification_profile
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
