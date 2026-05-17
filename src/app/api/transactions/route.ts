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
 * GET /api/transactions?limit=100
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "200");

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name, type), accounts(name, type, closing_day)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const flattenedData = (data || []).map((t: any) => ({
      ...t,
      category: t.categories,
      account: t.accounts,
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
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      id,
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
      is_third_party = false,
      third_party_name = null,
    } = body;

    if (!amount_cents || !transaction_type || !date || !description) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    
    let isCreditCard = false;
    if (account_id) {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('type')
        .eq('id', account_id)
        .single();
      if (accountData?.type === 'CREDIT_CARD') {
        isCreditCard = true;
      }
    }

    const txDate = new Date(date);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isPastMonth = txDate < currentMonthStart;

    const resolvedIsPaid = isCreditCard && transaction_type === 'EXPENSE'
      ? false
      : (is_paid ?? (isPastMonth ? true : false));

    const txData = {
      ...(id ? { id } : {}),
      user_id: user.id, // Forçar o ID do usuário logado
      account_id: account_id || null,
      category_id: category_id || null,
      amount_cents: Number(amount_cents) || 0,
      transaction_type,
      date,
      description,
      installment_current: Number(installment_current) || 1,
      installment_total: Number(installment_total) || 1,
      installment_group_id: installment_group_id || null,
      is_paid: resolvedIsPaid,
      source,
      is_third_party: !!is_third_party,
      third_party_name: third_party_name || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('transactions')
      .upsert(txData, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const txId = request.nextUrl.searchParams.get("id");
  const description = request.nextUrl.searchParams.get("description");
  const installmentTotalStr = request.nextUrl.searchParams.get("installment_total");
  const accountId = request.nextUrl.searchParams.get("account_id");

  try {
    const supabase = await createAdminClient();
    
    if (description && installmentTotalStr && accountId) {
      const installmentTotal = parseInt(installmentTotalStr);
      // Deletar a série inteira (em lote) no Supabase remoto
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .eq('description', description)
        .eq('installment_total', installmentTotal);
        
      if (error) throw error;
      return NextResponse.json({ success: true, mode: "series" });
    } else if (txId) {
      // Deletar transação individual
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)
        .eq('user_id', user.id);

      if (error) throw error;
      return NextResponse.json({ success: true, mode: "single" });
    } else {
      return NextResponse.json({ error: "Parâmetros obrigatórios faltando" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

