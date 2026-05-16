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
 * GET /api/gamification
 * Recupera o perfil de gamificação do usuário logado.
 * Se por algum motivo não houver perfil, inicializa um automaticamente.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('user_gamification_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    // Se por alguma inconsistência o perfil não existir, cria
    if (!data) {
      const initialProfile = {
        user_id: user.id,
        resilience_points: 0,
        current_streak: 0,
        max_streak: 0,
        active_theme: "brutalist-dark",
        unlocked_achievements: []
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('user_gamification_profile')
        .insert(initialProfile)
        .select()
        .single();

      if (insertError) throw insertError;
      return NextResponse.json(newProfile);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ Erro em GET /api/gamification:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/gamification
 * Atualiza ou insere o perfil de gamificação do usuário.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      resilience_points = 0,
      current_streak = 0,
      max_streak = 0,
      active_theme = "brutalist-dark",
      unlocked_achievements = []
    } = body;

    const supabase = await createAdminClient();

    const profileData = {
      user_id: user.id,
      resilience_points,
      current_streak,
      max_streak,
      active_theme,
      unlocked_achievements,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('user_gamification_profile')
      .upsert(profileData, { onConflict: 'user_id' })
      .select();

    if (error) throw error;
    return NextResponse.json(data ? data[0] : null);
  } catch (error: any) {
    console.error("❌ Erro em POST /api/gamification:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
