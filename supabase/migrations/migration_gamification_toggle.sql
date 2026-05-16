-- Migração para adicionar controle de alternância de gamificação no perfil do usuário
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gamification_enabled BOOLEAN DEFAULT TRUE;
