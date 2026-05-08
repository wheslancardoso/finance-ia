"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface SubscriptionModalContextType {
  isOpen: boolean;
  editingSubscription: any | null;
  openModal: (subscription?: any) => void;
  closeModal: () => void;
}

const SubscriptionModalContext = createContext<SubscriptionModalContextType | undefined>(undefined);

export function SubscriptionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<any | null>(null);

  const openModal = (subscription?: any) => {
    setEditingSubscription(subscription || null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingSubscription(null);
  };

  return (
    <SubscriptionModalContext.Provider value={{ isOpen, editingSubscription, openModal, closeModal }}>
      {children}
    </SubscriptionModalContext.Provider>
  );
}

export function useSubscriptionModal() {
  const context = useContext(SubscriptionModalContext);
  if (!context) {
    throw new Error("useSubscriptionModal must be used within a SubscriptionModalProvider");
  }
  return context;
}
