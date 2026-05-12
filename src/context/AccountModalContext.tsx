"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

interface AccountModalContextType {
  isOpen: boolean;
  isTransferOpen: boolean;
  accountToEdit: any | null;
  userId: string | null;
  openAdd: () => void;
  openEdit: (account: any) => void;
  openTransfer: () => void;
  closeModal: () => void;
  closeTransfer: () => void;
  setUserId: (id: string | null) => void;
}

const AccountModalContext = createContext<AccountModalContextType | undefined>(undefined);

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<any | null>(null);
  const [userId, setUserIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const isE2E = (window as any).__E2E_MOCK_STATE__;
      if (isE2E) return "e2e-user";
      
      const mockCookie = document.cookie.split('; ').find(row => row.startsWith('sb-mock-user-id='));
      if (mockCookie) return mockCookie.split('=')[1];
    }
    return null;
  });
  
  // Memoizar o cliente para evitar recriação em cada render e loops no useEffect
  const supabase = React.useMemo(() => createClient(), []);

  useEffect(() => {
    // 0. Sincronização imediata para testes (evita atrasos de chamadas assíncronas)
    if (typeof document !== 'undefined') {
      const mockCookie = document.cookie.split('; ').find(row => row.startsWith('sb-mock-user-id='));
      if (mockCookie) {
        const id = mockCookie.split('=')[1];
        setUserIdState(id);
      }
    }

    // 1. Verificar sessão inicial (Async)
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUserIdState(session.user.id);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      }
    };
    
    checkUser();

    // 2. Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserIdState(session.user.id);
      } else {
        // Se não houver sessão E não houver mock cookie, aí sim limpa
        const mockCookie = typeof document !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('sb-mock-user-id=')) : null;
        if (!mockCookie) {
          setUserIdState(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const setUserId = (id: string | null) => {
    setUserIdState(id);
  };

  const openAdd = () => {
    setAccountToEdit(null);
    setIsOpen(true);
  };

  const openEdit = (account: any) => {
    setAccountToEdit(account);
    setIsOpen(true);
  };

  const openTransfer = () => {
    setIsTransferOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setAccountToEdit(null);
  };

  const closeTransfer = () => {
    setIsTransferOpen(false);
  };

  return (
    <AccountModalContext.Provider 
      value={{ 
        isOpen, 
        isTransferOpen,
        accountToEdit, 
        userId, 
        openAdd, 
        openEdit, 
        openTransfer,
        closeModal,
        closeTransfer,
        setUserId 
      }}
    >
      {children}
    </AccountModalContext.Provider>
  );
}

export function useAccountModal() {
  const context = useContext(AccountModalContext);
  if (context === undefined) {
    throw new Error("useAccountModal must be used within an AccountModalProvider");
  }
  return context;
}
