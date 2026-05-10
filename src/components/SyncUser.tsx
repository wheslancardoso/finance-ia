"use client";

import { useEffect, useRef } from "react";
import { useAccountModal } from "@/context/AccountModalContext";
import { createClient } from "@/utils/supabase/client";

/**
 * SyncUser — Componente autônomo que resolve o userId
 * diretamente no client, sem depender de props de Server Components.
 * 
 * Deve ser montado UMA VEZ no AppShell para garantir que o contexto
 * esteja sempre populado, independentemente da página atual.
 * 
 * Aceita opcionalmente uma prop `userId` para compatibilidade
 * retroativa com páginas que já passam o valor do server.
 */
export function SyncUser({ userId: serverUserId }: { userId?: string | null }) {
  const { userId: contextUserId, setUserId } = useAccountModal();
  const isFetching = useRef(false);

  useEffect(() => {
    // Se recebeu do server, usar direto
    if (serverUserId) {
      setUserId(serverUserId);
      return;
    }

    // Se já temos no contexto, não precisa buscar de novo
    if (contextUserId) return;

    // Buscar autonomamente via Supabase client
    if (isFetching.current) return;
    isFetching.current = true;

    async function fetchUser() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          isFetching.current = false;
          return;
        }

        if (user.id) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error("SyncUser: erro ao buscar userId", err);
      } finally {
        isFetching.current = false;
      }
    }

    fetchUser();
  }, [serverUserId, contextUserId, setUserId]);

  return null;
}
