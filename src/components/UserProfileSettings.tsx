"use client";

import React, { useState } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { financialService } from "@/services/financialService";
import { formatCurrency } from "@/lib/utils";
import { Save, User, Wallet, Calculator, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserProfileSettings() {
  const { monthlyIncomeCents, fixedExpensesCents, refreshData } = useFinancialData();
  const { userId } = useAccountModal();
  
  const [income, setIncome] = useState((monthlyIncomeCents / 100).toString());
  const [expenses, setExpenses] = useState((fixedExpensesCents / 100).toString());
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync state when context changes
  React.useEffect(() => {
    setIncome((monthlyIncomeCents / 100).toString());
    setExpenses((fixedExpensesCents / 100).toString());
  }, [monthlyIncomeCents, fixedExpensesCents]);

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    
    const incomeCents = Math.round(parseFloat(income.replace(",", ".")) * 100);
    const expensesCents = Math.round(parseFloat(expenses.replace(",", ".")) * 100);

    const { error } = await financialService.upsertUserProfile({
      id: userId,
      monthly_income_cents: incomeCents,
      fixed_expenses_cents: expensesCents
    });

    if (!error) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      refreshData(); // Não aguardar o refresh para mostrar sucesso
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6" data-testid="user-profile-settings">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Renda Mensal Base</label>
          <div className="relative group">
            <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              data-testid="profile-income-input"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all font-medium"
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Gastos Fixos Estimados</label>
          <div className="relative group">
            <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              data-testid="profile-expenses-input"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all font-medium"
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        data-testid="profile-save-button"
        className={cn(
          "w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 relative overflow-hidden group",
          showSuccess 
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
            : "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
        )}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
        ) : showSuccess ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Configurações Salvas
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Salvar Diretrizes
          </>
        )}
      </button>

      <p className="text-[10px] text-white/20 text-center font-medium italic">
        * Estas diretrizes são usadas para calcular seu Teto de Sobrevivência e Health Score.
      </p>
    </div>
  );
}
