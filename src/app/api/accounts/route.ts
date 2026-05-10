import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounts?user_id=xxx
 * Lista todas as contas de um usuário.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/accounts
 * Cria ou atualiza uma conta (upsert).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      name,
      type,
      balance_cents = 0,
      credit_limit_cents = 0,
      closing_day,
      due_day,
      color_hex = "#7C3AED",
    } = body;

    if (!user_id || !name || !type) {
      return NextResponse.json(
        { error: "user_id, name e type são obrigatórios" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    console.log(`🏦 [API] Processando conta: ${name} (${type})`);

    const accountData = {
      ...(id ? { id } : {}),
      user_id,
      name,
      type,
      balance_cents,
      credit_limit_cents,
      closing_day: closing_day || null,
      due_day: due_day || null,
      color_hex,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('accounts')
      .upsert(accountData, { onConflict: 'id' })
      .select();

    if (error) {
      console.error("❌ [API] Erro no upsert de conta no Supabase:", error.message);
      throw error;
    }
    
    console.log(`✅ [API] Conta persistida com sucesso: ${data[0]?.id}`);
    return NextResponse.json(data ? data[0] : null);
  } catch (error: any) {
    console.error("❌ [API] POST /api/accounts error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts?id=xxx
 * Remove uma conta.
 */
export async function DELETE(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("id");
  if (!accountId) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
