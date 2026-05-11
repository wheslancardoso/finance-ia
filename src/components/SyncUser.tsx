"use client";

import { useEffect, useRef } from "react";
import { useAccountModal } from "@/context/AccountModalContext";

/**
 * SyncUser — Componente autônomo que sincroniza o userId para o contexto.
 * 
 * Agora ele apenas atua se uma prop `userId` for passada (ex: vindo do servidor),
 * caso contrário, o AccountModalContext já gerencia o userId via localStorage.
 */
export function SyncUser({ userId: serverUserId }: { userId?: string | null }) {
  const { userId: contextUserId, setUserId } = useAccountModal();
  const hasSet = useRef(false);

  useEffect(() => {
    if (hasSet.current) return;

    if (serverUserId && serverUserId !== contextUserId) {
      setUserId(serverUserId);
      hasSet.current = true;
    }
  }, [serverUserId, contextUserId, setUserId]);

  return null;
}
