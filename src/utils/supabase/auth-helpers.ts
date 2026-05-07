import { createClient } from "./server";

export async function getFamilyGroup() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Garantir que o Perfil do usuário existe
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

  // 2. Buscar os grupos familiares do usuário
  let { data: members } = await supabase
    .from("family_members")
    .select("family_group_id")
    .eq("user_id", user.id);

  let familyGroupId = members && members.length > 0 ? members[0].family_group_id : null;

  // 3. Se não tiver grupo, criar um inicial
  if (!familyGroupId) {
    const { data: newGroup, error: groupError } = await supabase
      .from("family_groups")
      .insert({ name: "Minha Família" })
      .select()
      .single();

    if (!groupError && newGroup) {
      familyGroupId = newGroup.id;
      await supabase
        .from("family_members")
        .insert({
          family_group_id: familyGroupId,
          user_id: user.id,
          role: "admin"
        });
    }
  }

  return familyGroupId;
}
