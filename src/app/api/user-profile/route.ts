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
 * POST /api/user-profile
 * Cria ou atualiza o perfil do usuário (renda mensal, gastos fixos).
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { monthly_income_cents, fixed_expenses_cents, gamification_enabled } = body;

    const supabase = await createAdminClient();
    
    const upsertData: any = {
      id: user.id,
      updated_at: new Date().toISOString()
    };

    if (monthly_income_cents !== undefined) upsertData.monthly_income_cents = Number(monthly_income_cents);
    if (fixed_expenses_cents !== undefined) upsertData.fixed_expenses_cents = Number(fixed_expenses_cents);
    if (gamification_enabled !== undefined) upsertData.gamification_enabled = Boolean(gamification_enabled);

    const { data, error } = await supabase
      .from('profiles')
      .upsert(upsertData, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
