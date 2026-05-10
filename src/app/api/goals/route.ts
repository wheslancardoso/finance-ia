import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/goals?user_id=xxx
 * Lista metas de um usuário.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/goals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/goals
 * Cria ou atualiza uma meta (upsert).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      name,
      target_amount_cents,
      current_amount_cents = 0,
      monthly_contribution_cents = 0,
      priority = 1,
      status = "ACTIVE",
      deadline,
      color_hex
    } = body;

    if (!user_id || !name || !target_amount_cents) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando (user_id, name, target_amount_cents)" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    

    const goalData = {
      ...(id ? { id } : {}),
      user_id,
      name,
      target_amount_cents,
      current_amount_cents,
      monthly_contribution_cents,
      priority,
      status,
      deadline: deadline || null,
      color_hex: color_hex || "#8b5cf6",
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('goals')
      .upsert(goalData, { onConflict: 'id' })
      .select();

    if (error) {
      console.error("❌ [API] Erro no upsert de metas no Supabase:", error.message);
      throw error;
    }
    
    return NextResponse.json(data ? data[0] : null);
  } catch (error: any) {
    console.error("❌ [API] POST /api/goals error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/goals?id=xxx
 * Remove uma meta.
 */
export async function DELETE(request: NextRequest) {
  const goalId = request.nextUrl.searchParams.get("id");
  if (!goalId) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/goals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
