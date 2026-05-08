"use client";

import { useEffect, useRef } from "react";
import { useAccountModal } from "@/context/AccountModalContext";
import { createClient } from "@/utils/supabase/client";

/**
 * SyncFamilyGroup — Componente autônomo que resolve o familyGroupId
 * diretamente no client, sem depender de props de Server Components.
 * 
 * Deve ser montado UMA VEZ no AppShell para garantir que o contexto
 * esteja sempre populado, independentemente da página atual.
 * 
 * Aceita opcionalmente uma prop `familyGroupId` para compatibilidade
 * retroativa com páginas que já passam o valor do server.
 */
export function SyncFamilyGroup({ familyGroupId: serverFamilyGroupId }: { familyGroupId?: string | null }) {
  const { familyGroupId: contextFamilyGroupId, setFamilyGroupId } = useAccountModal();
  const isFetching = useRef(false);

  useEffect(() => {
    // Se recebeu do server, usar direto
    if (serverFamilyGroupId) {
      setFamilyGroupId(serverFamilyGroupId);
      return;
    }

    // Se já temos no contexto, não precisa buscar de novo
    if (contextFamilyGroupId) return;

    // Buscar autonomamente via Supabase client
    if (isFetching.current) return;
    isFetching.current = true;

    async function fetchFamilyGroup() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          isFetching.current = false;
          return;
        }

        // Buscar membros do grupo familiar
        const { data: members } = await supabase
          .from("family_members")
          .select("family_group_id")
          .eq("user_id", user.id);

        let resolvedId = members && members.length > 0 ? members[0].family_group_id : null;

        // Se não tem grupo, criar um
        if (!resolvedId) {
          const { data: newGroup, error } = await supabase
            .from("family_groups")
            .insert({ name: "Minha Família" })
            .select()
            .single();

          if (!error && newGroup) {
            resolvedId = newGroup.id;
            await supabase
              .from("family_members")
              .insert({
                family_group_id: resolvedId,
                user_id: user.id,
                role: "admin"
              });
          }
        }

        if (resolvedId) {
          setFamilyGroupId(resolvedId);
        }
      } catch (err) {
        console.error("SyncFamilyGroup: erro ao buscar familyGroupId", err);
      } finally {
        isFetching.current = false;
      }
    }

    fetchFamilyGroup();
  }, [serverFamilyGroupId, contextFamilyGroupId, setFamilyGroupId]);

  return null;
}
