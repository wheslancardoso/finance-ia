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
 * GET /api/goals
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/goals
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      id,
      name,
      target_amount_cents,
      current_amount_cents = 0,
      monthly_contribution_cents = 0,
      priority = 1,
      status = "ACTIVE",
      deadline,
      color_hex
    } = body;

    if (!name || !target_amount_cents) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando (name, target_amount_cents)" },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();
    
    const goalData = {
      ...(id ? { id } : {}),
      user_id: user.id,
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

    if (error) throw error;
    return NextResponse.json(data ? data[0] : null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/goals?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const goalId = request.nextUrl.searchParams.get("id");
  if (!goalId) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const supabase = await createAdminClient();
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
