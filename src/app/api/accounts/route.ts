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
 * GET /api/accounts
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/accounts
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      id,
      name,
      type,
      balance_cents = 0,
      credit_limit_cents = 0,
      closing_day,
      due_day,
      color_hex = "#7C3AED",
    } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "name e type são obrigatórios" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    
    const accountData = {
      ...(id ? { id } : {}),
      user_id: user.id,
      name,
      type,
      balance_cents: Number(balance_cents) || 0,
      credit_limit_cents: Number(credit_limit_cents) || 0,
      closing_day: closing_day ? Number(closing_day) : null,
      due_day: due_day ? Number(due_day) : null,
      color_hex,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('accounts')
      .upsert(accountData, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const accountId = request.nextUrl.searchParams.get("id");
  if (!accountId) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const supabase = await createAdminClient();
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

