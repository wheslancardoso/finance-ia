import { createClient } from "./server";

export async function getFamilyGroup() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Buscar o grupo familiar do usuário
  let { data: familyMember } = await supabase
    .from("family_members")
    .select("family_group_id")
    .eq("user_id", user.id)
    .single();

  let familyGroupId = familyMember?.family_group_id;

  // Se não tiver grupo, criar um inicial
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
