-- SQL para limpar grupos duplicados mantendo apenas o mais recente por usuário
BEGIN;

-- 1. Identificar duplicatas e manter o mais recente
WITH ranked_members AS (
    SELECT 
        id, 
        user_id, 
        family_group_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rank
    FROM family_members
)
-- Deletar membros que não são o "rank 1" (o mais recente)
DELETE FROM family_members
WHERE id IN (
    SELECT id FROM ranked_members WHERE rank > 1
);

-- 2. Tentar deletar grupos que ficaram órfãos (sem membros)
-- Nota: Isso só funcionará se não houver outras FKs (contas, transações) apontando para eles.
DELETE FROM family_groups
WHERE id NOT IN (SELECT family_group_id FROM family_members);

COMMIT;
