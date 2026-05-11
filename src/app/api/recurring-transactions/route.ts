import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/recurring-transactions?user_id=xxx
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/recurring-transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/recurring-transactions
 * Upsert (Create or Update)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      description,
      amount_cents,
      transaction_type,
      frequency = "monthly",
      next_date,
      status = "active",
      category_id,
      account_id
    } = body;

    if (!user_id || !description || !amount_cents) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando (user_id, description, amount_cents)" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    const payload = {
      ...(id ? { id } : {}),
      user_id,
      description,
      amount_cents,
      transaction_type,
      frequency,
      next_date,
      status,
      category_id,
      account_id,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('recurring_transactions')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) throw error;
    
    return NextResponse.json(data ? data[0] : null);
  } catch (error: any) {
    console.error("POST /api/recurring-transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/recurring-transactions?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/recurring-transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
