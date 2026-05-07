"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface AccountModalContextType {
  isOpen: boolean;
  accountToEdit: any | null;
  familyGroupId: string | null;
  openAdd: () => void;
  openEdit: (account: any) => void;
  closeModal: () => void;
  setFamilyGroupId: (id: string) => void;
}

const AccountModalContext = createContext<AccountModalContextType | undefined>(undefined);

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<any | null>(null);
  const [familyGroupId, setFamilyGroupId] = useState<string | null>(null);

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
        familyGroupId, 
        openAdd, 
        openEdit, 
        closeModal,
        setFamilyGroupId 
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
