"use client";

import { useEffect, useRef } from "react";
import { useAccountModal } from "@/context/AccountModalContext";
import { LOCAL_USER_ID } from "@/lib/constants";

/**
 * SyncUser — Componente autônomo que resolve o userId.
 * 
 * Com a remoção do Supabase Auth, usa o LOCAL_USER_ID
 * como userId padrão para desenvolvimento local.
 * 
 * Aceita opcionalmente uma prop `userId` para sobrescrever.
 */
export function SyncUser({ userId: serverUserId }: { userId?: string | null }) {
  const { userId: contextUserId, setUserId } = useAccountModal();
  const hasSet = useRef(false);

  useEffect(() => {
    if (hasSet.current) return;

    // Prioridade: prop > contexto > LOCAL_USER_ID
    const resolvedId = serverUserId || contextUserId || LOCAL_USER_ID;
    
    if (resolvedId && resolvedId !== contextUserId) {
      setUserId(resolvedId);
      hasSet.current = true;
    }
  }, [serverUserId, contextUserId, setUserId]);

  return null;
}
