import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * GET /api/recurring-transactions
 */
export async function GET(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/recurring-transactions
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      id,
      description,
      amount_cents,
      transaction_type,
      frequency = "monthly",
      next_date,
      status = "active",
      category_id,
      account_id,
      is_primary_income
    } = body;

    if (!description || !amount_cents) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando (description, amount_cents)" },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();
    
    const payload = {
      ...(id ? { id } : {}),
      user_id: user.id,
      description,
      amount_cents,
      transaction_type,
      frequency,
      next_date,
      status,
      category_id,
      account_id,
      is_primary_income,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('recurring_transactions')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) throw error;

    return NextResponse.json(data ? data[0] : null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/recurring-transactions?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const supabase = await createAdminClient();
    
    // 1. Deletar transações físicas geradas por este fluxo que ainda não foram pagas
    // Isso evita deixar "previsões não pagas" fantasmas poluindo o extrato e distorcendo saldos de conta.
    await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('is_paid', false)
      .filter('source_metadata->>recurring_id', 'eq', id);

    // 2. Deletar a regra de recorrência
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
