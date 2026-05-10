"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface AccountModalContextType {
  isOpen: boolean;
  accountToEdit: any | null;
  userId: string | null;
  openAdd: () => void;
  openEdit: (account: any) => void;
  closeModal: () => void;
  setUserId: (id: string) => void;
}

const AccountModalContext = createContext<AccountModalContextType | undefined>(undefined);

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const openAdd = () => {
    setAccountToEdit(null);
    setIsOpen(true);
  };

  const openEdit = (account: any) => {
    setAccountToEdit(account);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setAccountToEdit(null);
  };

  return (
    <AccountModalContext.Provider 
      value={{ 
        isOpen, 
        accountToEdit, 
        userId, 
        openAdd, 
        openEdit, 
        closeModal,
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
