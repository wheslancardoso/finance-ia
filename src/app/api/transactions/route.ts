import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions?user_id=xxx&limit=100
 * Lista transações de um usuário.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "200");

  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name, type)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const flattenedData = (data || []).map((t: any) => ({
      ...t,
      category_name: t.categories?.name,
      category_type: t.categories?.type,
    }));

    return NextResponse.json(flattenedData);
  } catch (error: any) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/transactions
 * Cria ou atualiza uma transação (upsert).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      account_id,
      category_id,
      amount_cents,
      transaction_type,
      date,
      description,
      installment_current = 1,
      installment_total = 1,
      installment_group_id,
      is_paid = false,
      source = "MANUAL",
    } = body;

    if (!user_id || !amount_cents || !transaction_type || !date || !description) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    console.log(`📝 [API] Processando transação: ${description} (${amount_cents} cents)`);

    const txDate = new Date(date);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isPastMonth = txDate < currentMonthStart;

    const txData = {
      ...(id ? { id } : {}),
      user_id,
      account_id: account_id || null,
      category_id: category_id || null,
      amount_cents,
      transaction_type,
      date,
      description,
      installment_current,
      installment_total,
      installment_group_id: installment_group_id || null,
      is_paid: is_paid ?? (isPastMonth ? true : false),
      source,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('transactions')
      .upsert(txData, { onConflict: 'id' })
      .select();

    if (error) {
      console.error("❌ [API] Erro no upsert do Supabase:", error.message);
      throw error;
    }
    
    console.log(`✅ [API] Transação persistida com sucesso: ${data[0]?.id}`);
    return NextResponse.json(data ? data[0] : null);
  } catch (error: any) {
    console.error("❌ [API] POST /api/transactions error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions?id=xxx
 * Remove uma transação.
 */
export async function DELETE(request: NextRequest) {
  const txId = request.nextUrl.searchParams.get("id");
  if (!txId) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', txId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
