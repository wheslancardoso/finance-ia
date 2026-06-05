import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const { fromAccountId, toAccountId, amountCents, description } = body;

    if (!fromAccountId || !toAccountId || !amountCents || !description) {
      return NextResponse.json({ error: "Parâmetros obrigatórios faltando" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Validar se a conta de origem pertence ao usuário
    const { data: fromAcc, error: fromAccErr } = await supabase
      .from("accounts")
      .select("user_id, family_group_id")
      .eq("id", fromAccountId)
      .single();

    if (fromAccErr || !fromAcc || fromAcc.user_id !== user.id) {
      return NextResponse.json({ error: "Conta de origem inválida ou não pertence ao usuário" }, { status: 403 });
    }

    // Validar se a conta de destino pertence ao usuário
    const { data: toAcc, error: toAccErr } = await supabase
      .from("accounts")
      .select("user_id")
      .eq("id", toAccountId)
      .single();

    if (toAccErr || !toAcc || toAcc.user_id !== user.id) {
      return NextResponse.json({ error: "Conta de destino inválida ou não pertence ao usuário" }, { status: 403 });
    }

    // Chamar a RPC do Supabase de forma atômica
    const { data, error } = await supabase.rpc("create_transfer", {
      p_from_account_id: fromAccountId,
      p_to_account_id: toAccountId,
      p_amount_cents: amountCents,
      p_description: description,
      p_family_group_id: fromAcc.family_group_id
    });

    if (error) {
      console.error("❌ RPC create_transfer failed:", error);
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("❌ POST /api/transfers error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
