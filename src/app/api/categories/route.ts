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

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      id,
      family_group_id,
      name,
      type,
      icon_name,
      color_hex,
      ignore_dashboard,
      ignore_reports,
      ignore_balance
    } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    
    // Obter family_group_id se não fornecido
    let targetFamilyGroupId = family_group_id;
    if (!targetFamilyGroupId) {
      const { data: member } = await supabase
        .from('family_members')
        .select('family_group_id')
        .eq('user_id', user.id)
        .single();
      
      if (!member) {
         return NextResponse.json({ error: "Grupo familiar não encontrado" }, { status: 400 });
      }
      targetFamilyGroupId = member.family_group_id;
    }

    const categoryData = {
      ...(id ? { id } : {}),
      family_group_id: targetFamilyGroupId,
      name,
      type,
      icon_name: icon_name || 'Tags',
      color_hex: color_hex || '#9CA3AF',
      ignore_dashboard: !!ignore_dashboard,
      ignore_reports: !!ignore_reports,
      ignore_balance: !!ignore_balance,
      is_system_default: false
    };

    const { data, error } = await supabase
      .from('categories')
      .upsert(categoryData, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
