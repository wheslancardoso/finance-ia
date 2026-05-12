"use client";
import React, { useState, useMemo } from "react";
import { Calculator, AlertTriangle, CheckCircle2, XCircle, TrendingDown, Calendar, PlusCircle } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "./GlassCard";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useFinancialData } from "@/context/FinancialDataContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SpendingSimulator() {
  const { simulateDetailedImpact } = useFinancialAnalysis();
  const { upsertGoal } = useFinancialData();
  const [amount, setAmount] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);

  console.log("🔄 [SpendingSimulator] Render:", { amount, installments });

  const result = useMemo(() => {
    // Parsing robusto: remove pontos de milhar e converte vírgula para ponto
    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
    const valueCents = Math.round(parseFloat(cleanValue) * 100);
    
    if (isNaN(valueCents) || valueCents <= 0) {
      return null;
    }
    const res = simulateDetailedImpact(valueCents, installments);
    console.log("📊 [SpendingSimulator] Simulação:", { valueCents, installments, impact: res?.impact_percentage });
    return res;
  }, [amount, installments, simulateDetailedImpact]);

  const handleSaveAsGoal = async () => {
    console.log("💾 [SpendingSimulator] handleSaveAsGoal chamado. Amount:", amount, "Result:", result);
    if (!result || !amount) {
      console.warn("⚠️ [SpendingSimulator] Simulação incompleta, não é possível salvar.");
      return;
    }
    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
    const valueCents = Math.round(parseFloat(cleanValue) * 100);
    
    await upsertGoal({
      name: `${installments > 1 ? 'Parcelamento' : 'Compra'}: ${amount}`,
      target_amount_cents: valueCents,
      current_amount_cents: 0,
      priority: 3, // Prioridade alta para compras planejadas
      status: "PLANNING",
      monthly_contribution_cents: result.installment_impact 
    });
    
    setAmount("");
    setInstallments(1);
    // alert("Salvo como objetivo de planejamento!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SAFE": return "text-emerald-400";
      case "WARNING": return "text-amber-400";
      case "DANGER": return "text-rose-400";
      default: return "text-white/40";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "SAFE": return "bg-emerald-400/10 border-emerald-400/20";
      case "WARNING": return "bg-amber-400/10 border-amber-400/20";
      case "DANGER": return "bg-rose-400/10 border-rose-400/20";
      default: return "bg-white/5 border-white/10";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SAFE": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "WARNING": return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "DANGER": return <XCircle className="w-5 h-5 text-rose-400" />;
      default: return null;
    }
  };

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white tracking-tight text-sm">Simulador de Impacto</h3>
            <p className="text-[9px] uppercase tracking-widest text-white/30 font-black">Previsão Inteligente</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-sm">R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9,.]/g, "");
                console.log("⌨️ [SpendingSimulator] Input change:", val);
                setAmount(val);
              }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-lg font-bold text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
              data-testid="simulator-amount-input"
            />
          </div>
          <div className="col-span-4">
             <select 
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value))}
              className="w-full h-full bg-white/5 border border-white/10 rounded-2xl px-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none"
              data-testid="simulator-installments-select"
             >
               {[1,2,3,4,5,6,10,12,18,24].map(n => (
                 <option key={n} value={n} className="bg-[#121212]">{n}x</option>
               ))}
             </select>
          </div>
        </div>

        {result ? (
          <div 
            data-testid="simulator-status-indicator"
            className={cn("rounded-2xl border p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500", getStatusBg(result.status))}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getStatusIcon(result.status)}</div>
              <p className={cn("text-xs font-bold leading-relaxed", getStatusColor(result.status))}>
                {result.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
              <div>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Custo Mensal</p>
                <p className="text-base font-black text-white">{formatCurrency(result.installment_impact)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Impacto na Sobra</p>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  <p className="text-base font-black text-rose-400">{result.impact_percentage}%</p>
                </div>
              </div>
            </div>

            {result.debt_exit_delay_months > 0 && (
              <div className="bg-black/20 rounded-xl p-3 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-amber-400/60" />
                <div>
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Nova Saída das Dívidas</p>
                  <p className="text-xs font-bold text-amber-400">
                    {result.new_exit_date ? format(result.new_exit_date, "MMMM 'de' yyyy", { locale: ptBR }) : 'Indefinida'}
                  </p>
                </div>
              </div>
            )}

            {installments > 1 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Cronograma de Parcelas</p>
                <div className="flex gap-1 overflow-hidden h-1.5 rounded-full bg-white/5">
                  {Array.from({ length: installments }).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex-1 transition-all duration-500",
                        result.status === "SAFE" ? "bg-emerald-500/40" : 
                        result.status === "WARNING" ? "bg-amber-500/40" : "bg-rose-500/40"
                      )} 
                      style={{ transitionDelay: `${i * 50}ms` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[8px] font-bold text-white/40">
                  <span>Mês 1</span>
                  <span>Mês {installments}</span>
                </div>
              </div>
            )}

            <button 
              onClick={handleSaveAsGoal}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all group"
              data-testid="simulator-save-button"
            >
              <PlusCircle className="w-4 h-4 text-white/40 group-hover:text-violet-400" />
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover:text-white">Planejar esta Compra</span>
            </button>
          </div>
        ) : (
          <div className="py-6 text-center px-4 bg-white/2 rounded-2xl border border-dashed border-white/5">
            <p className="text-xs text-white/20 font-medium italic">
              &quot;Quanto custa seu desejo? Simule o impacto antes de comprometer seu futuro.&quot;
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
