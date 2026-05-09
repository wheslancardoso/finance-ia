-- ============================================================
-- 🌌 VESPER FINANCE — INTELIGÊNCIA FASE 5 (FIX)
-- Recomendações de Metas & Simulador de Impacto
-- ============================================================

-- 1. Limpeza de funções antigas para garantir nova assinatura
DROP FUNCTION IF EXISTS public.fn_get_goal_recommendations(uuid);
DROP FUNCTION IF EXISTS public.fn_simulate_spending(uuid, bigint);

-- ============================================================
-- RPC: fn_get_goal_recommendations
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_goal_recommendations(
  p_family_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projection JSONB;
  v_surplus BIGINT;
  v_goal RECORD;
  v_recommendations JSONB := '[]'::jsonb;
  v_amount_to_allocate BIGINT;
  v_remaining_surplus BIGINT;
BEGIN
  -- 1. Obter a projeção do mês atual
  -- Tentativa robusta de chamar a função get_month_projection
  BEGIN
    -- Tentativa 1: parâmetros posicionais
    v_projection := public.get_month_projection(p_family_group_id, CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      -- Tentativa 2: nomes de parâmetros específicos encontrados na spec (p_target_month)
      v_projection := public.get_month_projection(p_family_group_id := p_family_group_id, p_target_month := CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
      -- Tentativa 3: nome de parâmetro alternativo (p_target_date)
      v_projection := public.get_month_projection(p_family_group_id := p_family_group_id, p_target_date := CURRENT_DATE);
    END;
  END;
  
  -- Sobra Livre
  v_surplus := (v_projection->'projection'->>'projected_end_balance_cents')::bigint;
  v_remaining_surplus := COALESCE(v_surplus, 0);

  IF v_remaining_surplus <= 0 THEN
    RETURN jsonb_build_object(
      'surplus_cents', v_surplus,
      'recommendations', v_recommendations,
      'message', 'Sem sobra livre projetada para este mês.'
    );
  END IF;

  FOR v_goal IN (
    SELECT id, name, target_amount_cents, current_amount_cents, monthly_contribution_cents, priority
    FROM public.goals
    WHERE family_group_id = p_family_group_id
      AND status = 'active'
      AND current_amount_cents < target_amount_cents
    ORDER BY COALESCE(priority, 999) ASC, created_at ASC
  ) LOOP
    
    v_amount_to_allocate := COALESCE(v_goal.monthly_contribution_cents, 0);
    
    IF v_remaining_surplus < v_amount_to_allocate THEN
      v_amount_to_allocate := v_remaining_surplus;
    END IF;

    IF v_amount_to_allocate > 0 THEN
      v_recommendations := v_recommendations || jsonb_build_object(
        'goal_id', v_goal.id,
        'goal_name', v_goal.name,
        'recommended_amount_cents', v_amount_to_allocate,
        'is_full_target', v_amount_to_allocate = v_goal.monthly_contribution_cents
      );
      
      v_remaining_surplus := v_remaining_surplus - v_amount_to_allocate;
    END IF;

    EXIT WHEN v_remaining_surplus <= 0;
  END LOOP;

  RETURN jsonb_build_object(
    'surplus_cents', v_surplus,
    'remaining_surplus_cents', v_remaining_surplus,
    'recommendations', v_recommendations
  );
END;
$$;

-- ============================================================
-- RPC: fn_simulate_spending
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_simulate_spending(
  p_family_group_id UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projection JSONB;
  v_current_surplus BIGINT;
  v_new_surplus BIGINT;
  v_status TEXT;
  v_message TEXT;
BEGIN
  -- Chamada robusta para get_month_projection
  BEGIN
    v_projection := public.get_month_projection(p_family_group_id, CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_projection := public.get_month_projection(p_family_group_id := p_family_group_id, p_target_month := CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
      v_projection := public.get_month_projection(p_family_group_id := p_family_group_id, p_target_date := CURRENT_DATE);
    END;
  END;
  v_current_surplus := (v_projection->'projection'->>'projected_end_balance_cents')::bigint;
  
  v_new_surplus := COALESCE(v_current_surplus, 0) - p_amount_cents;

  IF v_new_surplus < 0 THEN
    v_status := 'DANGER';
    v_message := 'Este gasto deixará seu saldo negativo no fim do mês!';
  ELSIF v_new_surplus < (COALESCE(v_current_surplus, 0) * 0.2) THEN
    v_status := 'WARNING';
    v_message := 'Cuidado, este gasto consome quase toda sua sobra livre.';
  ELSE
    v_status := 'SAFE';
    v_message := 'Gasto dentro da margem de segurança.';
  END IF;

  RETURN jsonb_build_object(
    'current_surplus_cents', v_current_surplus,
    'simulated_surplus_cents', v_new_surplus,
    'status', v_status,
    'message', v_message,
    'impact_percentage', CASE WHEN COALESCE(v_current_surplus, 0) > 0 THEN ROUND((p_amount_cents::numeric / v_current_surplus::numeric) * 100, 2) ELSE 100 END
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.fn_get_goal_recommendations TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_simulate_spending TO authenticated, anon;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
