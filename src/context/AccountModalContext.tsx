"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { LOCAL_USER_ID } from "@/lib/constants";

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
  setUserId: (id: string) => void;
}

const AccountModalContext = createContext<AccountModalContextType | undefined>(undefined);

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<any | null>(null);
  const [userId, setUserIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("vesper_user_id");
      if (stored) return stored;
      // Fallback para o ID padrão caso não exista no localStorage
      const defaultId = LOCAL_USER_ID;
      localStorage.setItem("vesper_user_id", defaultId);
      return defaultId;
    }
    return null;
  });

  const setUserId = (id: string) => {
    setUserIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_user_id", id);
    }
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
