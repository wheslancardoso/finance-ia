"use client";

import React, { useState } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { financialService } from "@/services/financialService";
import { formatCurrency } from "@/lib/utils";
import { Save, User, Wallet, Calculator, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserProfileSettings() {
  const { 
    monthlyIncomeCents, 
    fixedExpensesCents, 
    refreshData, 
    isGamificationEnabled, 
    setGamificationEnabled,
    weeklyLimitOverrideCents,
    setWeeklyLimitOverrideCents
  } = useFinancialData();
  const { userId } = useAccountModal();
  
  const formatValue = (cents: number) => {
    if (!cents && cents !== 0) return "";
    return (cents / 100).toFixed(2).replace(".", ",");
  };

  const [income, setIncome] = useState(formatValue(monthlyIncomeCents));
  const [expenses, setExpenses] = useState(formatValue(fixedExpensesCents));
  const [weeklyOverride, setWeeklyOverride] = useState(formatValue(weeklyLimitOverrideCents));
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync state when context changes
  React.useEffect(() => {
    setIncome(formatValue(monthlyIncomeCents));
    setExpenses(formatValue(fixedExpensesCents));
    setWeeklyOverride(formatValue(weeklyLimitOverrideCents));
  }, [monthlyIncomeCents, fixedExpensesCents, weeklyLimitOverrideCents]);

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    
    const incomeCents = Math.round(parseFloat(income.replace(/\./g, "").replace(",", ".")) * 100);
    const expensesCents = Math.round(parseFloat(expenses.replace(/\./g, "").replace(",", ".")) * 100);
    const weeklyOverrideCents = weeklyOverride === "" ? 0 : Math.round(parseFloat(weeklyOverride.replace(/\./g, "").replace(",", ".")) * 100);

    const { error } = await financialService.upsertUserProfile({
      id: userId,
      monthly_income_cents: incomeCents,
      fixed_expenses_cents: expensesCents
    });

    if (!error) {
      if (!isNaN(weeklyOverrideCents)) {
        setWeeklyLimitOverrideCents(weeklyOverrideCents);
      } else {
        setWeeklyLimitOverrideCents(0);
      }
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

      <div className="space-y-2 mt-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Teto Semanal Personalizado</label>
        <div className="relative group">
          <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-violet-400 transition-colors" />
          <input
            type="text"
            value={weeklyOverride}
            onChange={(e) => setWeeklyOverride(e.target.value.replace(/[^0-9,.]/g, ""))}
            data-testid="profile-weekly-override-input"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all font-medium"
            placeholder="0,00"
          />
        </div>
        <p className="text-[8px] text-white/30 ml-2 font-medium">
          Deixe zerado ou vazio para usar o Oráculo de Sobrevivência Dinâmico automático.
        </p>
      </div>

      <div className="h-px bg-white/10 my-6" />

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">Modo Resiliência Gamificada</span>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
              Ativa o HUD brutalista, contagem de streaks, ganho de pontos de resiliência e bloqueio automático de metas de consumo sob Modo Crise.
            </p>
          </div>
          
          <button
            onClick={() => setGamificationEnabled(!isGamificationEnabled)}
            data-testid="toggle-gamification-button"
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              isGamificationEnabled 
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20" 
                : "bg-white/5 text-white/40 border border-white/10 hover:border-white/20"
            )}
          >
            {isGamificationEnabled ? "Ativado" : "Desativado"}
          </button>
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
