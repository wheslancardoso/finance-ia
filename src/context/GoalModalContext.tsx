"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface GoalModalContextType {
  isOpen: boolean;
  isContributionOpen: boolean;
  selectedGoal: any | null;
  openModal: () => void;
  openContribution: (goal: any) => void;
  closeModal: () => void;
}

const GoalModalContext = createContext<GoalModalContextType | undefined>(undefined);

export function GoalModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isContributionOpen, setIsContributionOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);

  const openModal = () => {
    setSelectedGoal(null);
    setIsOpen(true);
  };

  const openContribution = (goal: any) => {
    setSelectedGoal(goal);
    setIsContributionOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setIsContributionOpen(false);
    setSelectedGoal(null);
  };

  return (
    <GoalModalContext.Provider 
      value={{ 
        isOpen, 
        isContributionOpen, 
        selectedGoal, 
        openModal, 
        openContribution, 
        closeModal 
      }}
    >
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
