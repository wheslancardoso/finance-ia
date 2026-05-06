"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface TransactionModalContextType {
  isOpen: boolean;
  transactionToEdit: any | null;
  openAdd: () => void;
  openEdit: (transaction: any) => void;
  closeModal: () => void;
}

const TransactionModalContext = createContext<TransactionModalContextType | undefined>(undefined);

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any | null>(null);

  const openAdd = () => {
    setTransactionToEdit(null);
    setIsOpen(true);
  };

  const openEdit = (transaction: any) => {
    setTransactionToEdit(transaction);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setTransactionToEdit(null);
  };

  return (
    <TransactionModalContext.Provider value={{ isOpen, transactionToEdit, openAdd, openEdit, closeModal }}>
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
