"use client";
import React, { useState, useMemo } from "react";
import { Calculator, AlertTriangle, CheckCircle2, XCircle, TrendingDown, TrendingUp, PlusCircle } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useTransactionModal } from "@/context/TransactionModalContext";

interface SpendingSimulatorProps {
  onSimulate?: (simulation: { amount_cents: number; installments: number; type: "EXPENSE" | "INCOME" } | null) => void;
  targetDate?: Date;
}

export default function SpendingSimulator({ onSimulate, targetDate }: SpendingSimulatorProps) {
  const { simulateDetailedImpact } = useFinancialAnalysis();
  const { upsertGoal } = useFinancialData();
  const { openAdd } = useTransactionModal();
  const [amount, setAmount] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);
  const [simulationType, setSimulationType] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  const result = useMemo(() => {
    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
    const valueCents = Math.round(parseFloat(cleanValue) * 100);
    
    if (isNaN(valueCents) || valueCents <= 0) return null;
    return simulateDetailedImpact(valueCents, installments, simulationType);
  }, [amount, installments, simulationType, simulateDetailedImpact]);

  React.useEffect(() => {
    if (onSimulate) {
      const cleanValue = amount.replace(/\./g, "").replace(",", ".");
      const valueCents = Math.round(parseFloat(cleanValue) * 100);
      if (!isNaN(valueCents) && valueCents > 0) {
        onSimulate({ amount_cents: valueCents, installments, type: simulationType });
      } else {
        onSimulate(null);
      }
    }
  }, [amount, installments, simulationType, onSimulate]);

  const getStatusColor = (status: string) => {
    if (simulationType === "INCOME") return "text-emerald-400";
    switch (status) {
      case "SAFE": return "text-emerald-400";
      case "WARNING": return "text-amber-400";
      case "DANGER": return "text-rose-400";
      default: return "text-white/40";
    }
  };

  const getStatusBg = (status: string) => {
    if (simulationType === "INCOME") return "bg-emerald-400/10 border-emerald-400/20";
    switch (status) {
      case "SAFE": return "bg-emerald-400/10 border-emerald-400/20";
      case "WARNING": return "bg-amber-400/10 border-amber-400/20";
      case "DANGER": return "bg-rose-400/10 border-rose-400/20";
      default: return "bg-white/5 border-white/10";
    }
  };

  const getStatusIcon = (status: string) => {
    if (simulationType === "INCOME") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    switch (status) {
      case "SAFE": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "WARNING": return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "DANGER": return <XCircle className="w-4 h-4 text-rose-400" />;
      default: return null;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-[32px] p-5 h-full flex flex-col shadow-2xl relative overflow-hidden">
      <div className="flex items-center gap-2.5 mb-4 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Simulador</h3>
          <p className="text-[9px] uppercase tracking-widest text-white/30 font-black">Previsão</p>
        </div>
      </div>

      {/* Simulation Type Selector Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-2xl mb-4 relative z-10">
        <button
          onClick={() => {
            setSimulationType("EXPENSE");
            setInstallments(1);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
            simulationType === "EXPENSE"
              ? "bg-red-500/10 border border-red-500/20 text-red-400 shadow-md"
              : "text-white/40 hover:text-white/60 hover:bg-white/[0.01]"
          )}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Gasto
        </button>
        <button
          onClick={() => {
            setSimulationType("INCOME");
            setInstallments(1);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
            simulationType === "INCOME"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-md"
              : "text-white/40 hover:text-white/60 hover:bg-white/[0.01]"
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Receita
        </button>
      </div>

      <div className="space-y-4 relative z-10 flex-1">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 font-bold text-xs">R$</span>
            <input
              data-testid="simulator-amount-input"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.]/g, ""))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-base font-bold text-white placeholder:text-white/10 focus:outline-none transition-all"
            />
          </div>
          <div className="w-20 relative">
             <select 
              data-testid="simulator-installments-select"
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value))}
              className="w-full h-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs font-bold text-white focus:outline-none appearance-none text-center cursor-pointer"
             >
               {[1,2,3,4,5,6,10,12].map(n => (
                 <option key={n} value={n} className="bg-[#121212]">{n}x</option>
               ))}
             </select>
          </div>
        </div>

        {result ? (
          <div 
            data-testid="simulator-status-indicator"
            className={cn("rounded-xl border p-3.5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 max-h-none", getStatusBg(result.status))}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{getStatusIcon(result.status)}</div>
              <p className={cn("text-[10px] font-bold leading-relaxed", getStatusColor(result.status))}>
                {result.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/5">
              <div>
                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mb-0.5">
                  {simulationType === "INCOME" ? "Receita Mensal" : "Mensal"}
                </p>
                <p className="text-sm font-black text-white">{formatCurrency(result.installment_impact)}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mb-0.5">Fôlego</p>
                <div className="flex items-center gap-1">
                  {simulationType === "INCOME" ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <p className={cn(
                    "text-sm font-black",
                    simulationType === "INCOME" ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {simulationType === "INCOME" ? "+" : ""}{result.impact_percentage}%
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <button 
                  data-testid="simulator-save-button"
                  onClick={async () => {
                    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
                    const valueCents = Math.round(parseFloat(cleanValue) * 100);
                    await upsertGoal({
                      name: simulationType === "INCOME"
                        ? (installments > 1 ? `Receita Extra: ${amount} (x${installments})` : `Renda Extra: ${amount}`)
                        : (installments > 1 ? `Parcelamento: ${amount}` : `Compra: ${amount}`),
                      target_amount_cents: valueCents,
                      current_amount_cents: 0,
                      monthly_contribution_cents: simulationType === "INCOME" ? -result.installment_impact : result.installment_impact,
                      status: 'active'
                    });
                    setAmount("");
                    setInstallments(1);
                  }}
                  className="flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-3 h-3" />
                  Salvar como Meta
                </button>
                
                <button 
                  onClick={() => { setAmount(""); setInstallments(1); }}
                  className="px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </div>

              <button 
                onClick={() => {
                  const defaultDate = targetDate 
                    ? targetDate.toISOString().split('T')[0] 
                    : new Date().toISOString().split('T')[0];

                  openAdd(null, {
                    amount: amount,
                    description: simulationType === "INCOME" 
                      ? (installments > 1 ? `Receita Extra Projetada (x${installments})` : `Receita Extra Projetada`)
                      : (installments > 1 ? `Gasto Projetado (x${installments})` : `Gasto Projetado`),
                    type: simulationType,
                    date: defaultDate,
                    installments: installments
                  });
                  setAmount("");
                  setInstallments(1);
                }}
                className="w-full py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-3 h-3 text-violet-400" />
                Agendar Gasto/Receita
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center border border-dashed border-white/5 rounded-xl">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-bold">
              {simulationType === "INCOME" ? "Simular nova receita" : "Simular novo gasto"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
