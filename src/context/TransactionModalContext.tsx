"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface TransactionModalContextType {
  isOpen: boolean;
  transactionToEdit: any | null;
  defaultAccountId: string | null;
  openAdd: (defaultAccountId?: string | null) => void;
  openEdit: (transaction: any) => void;
  closeModal: () => void;
}

const TransactionModalContext = createContext<TransactionModalContextType | undefined>(undefined);

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);

  const openAdd = (defaultAccId?: string | null) => {
    setTransactionToEdit(null);
    setDefaultAccountId(defaultAccId || null);
    setIsOpen(true);
  };

  const openEdit = (transaction: any) => {
    setTransactionToEdit(transaction);
    setDefaultAccountId(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setTransactionToEdit(null);
    setDefaultAccountId(null);
  };

  return (
    <TransactionModalContext.Provider value={{ isOpen, transactionToEdit, defaultAccountId, openAdd, openEdit, closeModal }}>
      {children}
    </TransactionModalContext.Provider>
  );
}

export function useTransactionModal() {
  const context = useContext(TransactionModalContext);
  if (context === undefined) {
    throw new Error("useTransactionModal must be used within a TransactionModalProvider");
  }
  return context;
}
