"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface GoalModalContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const GoalModalContext = createContext<GoalModalContextType | undefined>(undefined);

export function GoalModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <GoalModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </GoalModalContext.Provider>
  );
}

export function useGoalModal() {
  const context = useContext(GoalModalContext);
  if (!context) {
    throw new Error("useGoalModal must be used within a GoalModalProvider");
  }
  return context;
}
