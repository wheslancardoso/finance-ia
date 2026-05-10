"use client";

import React from "react";
import { Plus } from "lucide-react";
import { useAccountModal } from "@/context/AccountModalContext";

export function AccountsHeader() {
  const { openAdd } = useAccountModal();

  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Minhas Contas</h2>
        <p className="text-white/40 font-medium">Gerencie seus ativos e cartões em um só lugar.</p>
      </div>
      
      <button 
        onClick={openAdd}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-semibold transition-all shadow-lg shadow-violet-600/20 active:scale-95"
        data-testid="add-account-button"
      >
        <Plus className="w-5 h-5" />
        Nova Conta
      </button>
    </header>
  );
}
