import { createClient } from "./server";

export async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Garantir que o Perfil do usuário existe
  let { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url
    });
  }

  // Agora que simplificamos, o isolamento é por ID do usuário.
  return user.id;
}
