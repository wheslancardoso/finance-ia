import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
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

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { account_id, current_app_balance_cents, target_bank_balance_cents, date } = await request.json();

    if (!account_id || current_app_balance_cents == null || target_bank_balance_cents == null) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const difference_cents = target_bank_balance_cents - current_app_balance_cents;

    if (difference_cents === 0) {
      return NextResponse.json({ success: true, message: "Saldos já estão batendo." });
    }

    const transaction_type = difference_cents > 0 ? "INCOME" : "EXPENSE";
    const amount_cents = Math.abs(difference_cents);
    const description = "Ajuste de Reconciliação Bancária";

    const supabaseAdmin = await createAdminClient();

    // 1. Tentar achar a categoria "Outros" ou criar uma para o ajuste
    let category_id = null;
    const { data: catData } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('name', 'Outros')
      .eq('type', transaction_type)
      .limit(1)
      .single();
    
    if (catData) {
      category_id = catData.id;
    }

    const txData = {
      user_id: user.id,
      account_id,
      category_id,
      amount_cents,
      transaction_type,
      date: date || new Date().toISOString(),
      description,
      installment_current: 1,
      installment_total: 1,
      is_paid: true,
      source: "RECONCILIATION",
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert(txData)
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      transaction: data[0], 
      difference_cents 
    });

  } catch (error: any) {
    console.error("Erro na reconciliação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
