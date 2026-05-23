"use client";
import React, { useState, useMemo } from "react";
import { Calculator, AlertTriangle, CheckCircle2, XCircle, TrendingDown, TrendingUp, PlusCircle, Sparkles } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useTransactionModal } from "@/context/TransactionModalContext";

interface SpendingSimulatorProps {
  onSimulate?: (simulation: { amount_cents: number; installments: number; type: "EXPENSE" | "INCOME" } | null) => void;
  targetDate?: Date;
}

export default function SpendingSimulator({ onSimulate, targetDate }: SpendingSimulatorProps) {
  const { simulateDetailedImpact, analyzeSimulationIA, solveFinancialDilemma, consultJarvisIA } = useFinancialAnalysis();
  const { upsertGoal, accounts, upsertTransaction, createInstallmentSeries } = useFinancialData();
  const { openAdd } = useTransactionModal();
  const [amount, setAmount] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);
  const [simulationType, setSimulationType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [isLoan, setIsLoan] = useState<boolean>(false);
  const [loanInstallment, setLoanInstallment] = useState<string>("");
  const [loanInstallmentsCount, setLoanInstallmentsCount] = useState<number>(3);

  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  
  const [dilemma, setDilemma] = useState<string>("");
  const [dilemmaResult, setDilemmaResult] = useState<{ advice: string; simulations: any[] } | null>(null);
  const [isDilemmaLoading, setIsDilemmaLoading] = useState<boolean>(false);

  const [jarvisResult, setJarvisResult] = useState<{ advice: string; suggested_loan_amount_cents: number; loan_verdict: string; postponement_tips: string[] } | null>(null);
  const [isJarvisLoading, setIsJarvisLoading] = useState<boolean>(false);

  // Helper para renderização nativa de Markdown brutalista premium
  const renderMarkdown = (text: string) => {
    return text.split("\n\n").map((para, i) => {
      const cleanPara = para.trim();
      if (!cleanPara) return null;
      
      if (cleanPara.startsWith("###")) {
        const title = cleanPara.replace(/^###\s*/, "");
        return (
          <h4 key={i} className="text-[10px] font-black uppercase tracking-wider text-violet-400 mt-3 mb-1">
            {title}
          </h4>
        );
      }
      
      const parts = cleanPara.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} className="text-[9px] leading-relaxed text-white/60 font-medium">
          {parts.map((part, idx) => (idx % 2 === 1 ? <strong key={idx} className="font-black text-white">{part}</strong> : part))}
        </p>
      );
    });
  };

  const result = useMemo(() => {
    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
    const valueCents = Math.round(parseFloat(cleanValue) * 100);
    
    if (isNaN(valueCents) || valueCents <= 0) return null;

    if (simulationType === "INCOME" && isLoan) {
      const cleanInstallment = loanInstallment.replace(/\./g, "").replace(",", ".");
      const installmentCents = Math.round(parseFloat(cleanInstallment) * 100);
      if (!isNaN(installmentCents) && installmentCents > 0) {
        return simulateDetailedImpact(valueCents, installments, simulationType, installmentCents, loanInstallmentsCount);
      }
    }
    return simulateDetailedImpact(valueCents, installments, simulationType);
  }, [amount, installments, simulationType, simulateDetailedImpact, isLoan, loanInstallment, loanInstallmentsCount]);

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

        {simulationType === "INCOME" && (
          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-3.5 space-y-3">
            <label className="flex items-center gap-2.5 text-[9px] font-black uppercase tracking-wider text-white/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isLoan}
                onChange={(e) => {
                  setIsLoan(e.target.checked);
                  if (!e.target.checked) setLoanInstallment("");
                }}
                className="w-4 h-4 bg-white/5 border border-white/10 rounded cursor-pointer accent-emerald-500"
              />
              Simular como Empréstimo
            </label>

            {isLoan && (
              <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest block">Custo Parcela</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 font-bold text-[9px]">R$</span>
                    <input
                      data-testid="simulator-loan-installment-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={loanInstallment}
                      onChange={(e) => setLoanInstallment(e.target.value.replace(/[^0-9,.]/g, ""))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-7 pr-2 text-xs font-bold text-white placeholder:text-white/10 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest block">Nº Parcelas</span>
                  <select 
                    value={loanInstallmentsCount}
                    onChange={(e) => setLoanInstallmentsCount(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none appearance-none text-center cursor-pointer cursor-pointer"
                  >
                    {[1,2,3,4,5,6,10,12,18,24,36].map(n => (
                      <option key={n} value={n} className="bg-[#121212]">{n}x</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

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

            {simulationType === "INCOME" && isLoan && result.loan_monthly_interest_rate !== undefined && (
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/5 bg-white/[0.01] rounded-xl p-2 animate-in fade-in duration-200">
                <div>
                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-0.5">Juros Mensais</p>
                  <p className="text-xs font-black text-emerald-400">{(result.loan_monthly_interest_rate * 100).toFixed(2)}% a.m.</p>
                </div>
                <div>
                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-0.5">CET Total / Juros</p>
                  <p className="text-xs font-black text-rose-400">
                    +{result.loan_cet_percentage}% ({formatCurrency(result.loan_total_interest_cents || 0)})
                  </p>
                </div>
              </div>
            )}

            {/* Vesper Copilot AI Advisor */}
            <div className="pt-2.5 border-t border-white/5 space-y-2">
              {!aiAdvice && !isAiLoading ? (
                <button
                  onClick={async () => {
                    if (!result) return;
                    setIsAiLoading(true);
                    setAiAdvice(null);
                    try {
                      const cleanValue = amount.replace(/\./g, "").replace(",", ".");
                      const valueCents = Math.round(parseFloat(cleanValue) * 100);
                      const simulationObj = {
                        amount_cents: valueCents,
                        installments,
                        type: simulationType,
                        loanInstallmentCents: simulationType === "INCOME" && isLoan ? Math.round(parseFloat(loanInstallment.replace(/\./g, "").replace(",", ".")) * 100) : undefined,
                        loanInstallmentsCount: simulationType === "INCOME" && isLoan ? loanInstallmentsCount : undefined,
                        loan_monthly_interest_rate: result.loan_monthly_interest_rate,
                        loan_cet_percentage: result.loan_cet_percentage,
                        loan_total_interest_cents: result.loan_total_interest_cents,
                        status: result.status
                      };
                      const advice = await analyzeSimulationIA(simulationObj);
                      setAiAdvice(advice);
                    } catch (e) {
                      setAiAdvice("Falha ao consultar a análise de IA.");
                    } finally {
                      setIsAiLoading(false);
                    }
                  }}
                  className="w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5 text-violet-400" />
                  Consultar Vesper Copilot (IA)
                </button>
              ) : isAiLoading ? (
                <div className="py-3 text-center bg-violet-500/5 border border-violet-500/10 rounded-xl animate-pulse">
                  <span className="text-[8px] font-black text-violet-400 uppercase tracking-widest block">Consultando Oráculo...</span>
                </div>
              ) : (
                <div className="bg-black/40 border border-violet-500/10 rounded-xl p-3.5 space-y-2 relative overflow-hidden animate-in fade-in duration-200">
                  <button 
                    onClick={() => setAiAdvice(null)}
                    className="absolute top-2 right-2 text-white/20 hover:text-white transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[7px] font-black text-violet-400 uppercase tracking-widest mb-1">Vesper AI Copilot</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {renderMarkdown(aiAdvice || "")}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-3">
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
                    setIsLoan(false);
                    setLoanInstallment("");
                  }}
                  className="flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-3 h-3" />
                  Salvar como Meta
                </button>
                
                <button 
                  onClick={() => {
                    setAmount("");
                    setInstallments(1);
                    setIsLoan(false);
                    setLoanInstallment("");
                  }}
                  className="px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </div>

              <button 
                onClick={async () => {
                  const defaultDate = targetDate 
                    ? targetDate.toISOString().split('T')[0] 
                    : new Date().toISOString().split('T')[0];

                  if (simulationType === "INCOME" && isLoan) {
                    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
                    const valueCents = Math.round(parseFloat(cleanValue) * 100);
                    
                    // 1. Agendar a receita à vista (Entrada do Empréstimo)
                    await upsertTransaction({
                      description: `Empréstimo Caixa (Receita)`,
                      amount_cents: valueCents,
                      transaction_type: "INCOME",
                      date: defaultDate,
                      is_paid: false
                    });

                    // 2. Criar série de parcelas do empréstimo (Despesa)
                    const activeAccount = accounts.find(a => a.type !== "CREDIT_CARD") || accounts[0];
                    if (activeAccount) {
                      const cleanInstallment = loanInstallment.replace(/\./g, "").replace(",", ".");
                      const installmentCents = Math.round(parseFloat(cleanInstallment) * 100);
                      
                      await createInstallmentSeries({
                        description: `Parcela Empréstimo`,
                        amount_total_cents: installmentCents * loanInstallmentsCount,
                        installments: loanInstallmentsCount,
                        account_id: activeAccount.id,
                        start_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString().split('T')[0] // Vence dia 15 do próximo mês
                      });
                    }
                  } else {
                    openAdd(null, {
                      amount: amount,
                      description: simulationType === "INCOME" 
                        ? (installments > 1 ? `Receita Extra Projetada (x${installments})` : `Receita Extra Projetada`)
                        : (installments > 1 ? `Gasto Projetado (x${installments})` : `Gasto Projetado`),
                      type: simulationType,
                      date: defaultDate,
                      installments: installments
                    });
                  }

                  setAmount("");
                  setInstallments(1);
                  setIsLoan(false);
                  setLoanInstallment("");
                }}
                className="w-full py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-3 h-3 text-violet-400" />
                {simulationType === "INCOME" && isLoan ? "Agendar Empréstimo Completo" : "Agendar Gasto/Receita"}
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

      {/* AI Dilemma Box */}
      <div className="mt-4 pt-4 border-t border-white/5 relative z-10 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Consultar Dilema com IA</span>
          {dilemmaResult && (
            <button 
              onClick={() => {
                setDilemmaResult(null);
                setDilemma("");
              }}
              className="text-[8px] font-black text-red-400 hover:underline uppercase tracking-wider bg-transparent border-none cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {!dilemmaResult && !isDilemmaLoading ? (
          <div className="space-y-2">
            <textarea
              value={dilemma}
              onChange={(e) => setDilemma(e.target.value)}
              placeholder="Descreva seu dilema (Ex: Notebook novo em 10x ou consertar o carro à vista?)"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-[10px] font-bold text-white placeholder:text-white/10 focus:outline-none transition-all resize-none h-16 leading-relaxed"
            />
            <button
              onClick={async () => {
                if (!dilemma.trim()) return;
                setIsDilemmaLoading(true);
                try {
                  const res = await solveFinancialDilemma(dilemma);
                  setDilemmaResult(res);
                } catch (e) {
                  setDilemmaResult({ advice: "Falha ao resolver dilema.", simulations: [] });
                } finally {
                  setIsDilemmaLoading(false);
                }
              }}
              disabled={!dilemma.trim()}
              className={cn(
                "w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                dilemma.trim() 
                  ? "bg-violet-600 text-white hover:bg-violet-500 border border-violet-500/20" 
                  : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
              )}
            >
              Resolver com Copiloto
            </button>
          </div>
        ) : isDilemmaLoading ? (
          <div className="py-4 text-center bg-violet-500/5 border border-violet-500/10 rounded-xl animate-pulse">
            <span className="text-[8px] font-black text-violet-400 uppercase tracking-widest block">Analisando dilema...</span>
          </div>
        ) : (
          <div className="bg-black/50 border border-violet-500/20 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-300">
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {renderMarkdown(dilemmaResult?.advice || "")}
            </div>

            {dilemmaResult?.simulations && dilemmaResult.simulations.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-2">
                <p className="text-[7px] font-black text-violet-400 uppercase tracking-widest">Simulações Geradas</p>
                <div className="space-y-1.5">
                  {dilemmaResult.simulations.map((sim: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg p-2 text-[9px]">
                      <div className="min-w-0 text-left">
                        <p className="font-bold text-white truncate">{sim.description}</p>
                        <p className="text-[8px] text-white/30 uppercase font-black">{sim.type === "INCOME" ? "Receita" : "Gasto"} • {sim.installments}x</p>
                      </div>
                      <span className={cn("font-black shrink-0 ml-2", sim.type === "INCOME" ? "text-emerald-400" : "text-rose-400")}>
                        {formatCurrency(sim.amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const sim = dilemmaResult.simulations[0];
                    if (sim) {
                      setSimulationType(sim.type);
                      setAmount((sim.amount_cents / 100).toFixed(2).replace(".", ","));
                      setInstallments(sim.installments || 1);
                      if (sim.type === "INCOME" && sim.description.toLowerCase().includes("empréstimo")) {
                        setIsLoan(true);
                        setLoanInstallment("");
                      } else {
                        setIsLoan(false);
                      }
                      // Limpar resultado para focar no simulador
                      setDilemmaResult(null);
                      setDilemma("");
                    }
                  }}
                  className="w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-black" />
                  Carregar no Simulador
                </button>
              </div>
            )}
          </div>
        )}

        {/* Vesper Jarvis: Gabinete de Crise */}
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
              <h4 className="text-[10px] font-black text-white/85 uppercase tracking-widest">Jarvis Console (Gabinete de Crise)</h4>
            </div>
            {jarvisResult && (
              <button 
                onClick={() => {
                  setJarvisResult(null);
                }}
                className="text-[8px] font-black text-red-400 hover:underline uppercase tracking-wider bg-transparent border-none cursor-pointer"
              >
                Fechar
              </button>
            )}
          </div>

          {!jarvisResult && !isJarvisLoading ? (
            <div className="space-y-2 text-left">
              <p className="text-[8px] text-white/40 leading-relaxed">
                Jarvis analisa todo seu caixa (contas, fluxos recorrentes, transações de Junho/2026, metas) e dá um veredito preciso de respiro e valor ótimo de empréstimo.
              </p>
              <button
                onClick={async () => {
                  setIsJarvisLoading(true);
                  try {
                    const cleanValue = amount.replace(/\./g, "").replace(",", ".");
                    const valueCents = Math.round(parseFloat(cleanValue) * 100);
                    
                    let activeSim = null;
                    if (!isNaN(valueCents) && valueCents > 0) {
                      const cleanInstallment = loanInstallment.replace(/\./g, "").replace(",", ".");
                      const installmentCents = Math.round(parseFloat(cleanInstallment) * 100);
                      activeSim = {
                        description: simulationType === "INCOME" ? "Simulação Receita" : "Simulação Despesa",
                        amount_cents: valueCents,
                        installments,
                        type: simulationType,
                        loanInstallmentCents: isLoan ? installmentCents : 0,
                        loanInstallmentsCount: isLoan ? loanInstallmentsCount : 0
                      };
                    }
                    
                    const res = await consultJarvisIA(activeSim);
                    setJarvisResult(res);
                  } catch (e) {
                    setJarvisResult({
                      advice: "### 🤖 Jarvis: Falha no Processamento\n\nNão foi possível auditar o caixa consolidado.",
                      suggested_loan_amount_cents: 0,
                      loan_verdict: "Erro de consulta.",
                      postponement_tips: []
                    });
                  } finally {
                    setIsJarvisLoading(false);
                  }
                }}
                className="w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                data-testid="jarvis-consult-button"
              >
                Consultar Jarvis IA
              </button>
            </div>
          ) : isJarvisLoading ? (
            <div className="py-4 text-center bg-violet-500/5 border border-violet-500/10 rounded-xl animate-pulse">
              <span className="text-[8px] font-black text-violet-400 uppercase tracking-widest block">Jarvis Auditando Caixa Consolidado...</span>
            </div>
          ) : (
            <div className="bg-black/50 border border-violet-500/20 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-300">
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-left">
                {renderMarkdown(jarvisResult?.advice || "")}
              </div>

              {jarvisResult && jarvisResult.loan_verdict && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-left">
                  <span className="text-[8px] font-black uppercase tracking-widest text-red-400 block mb-0.5">Veredito do Copiloto</span>
                  <p className="text-[10px] font-bold text-white leading-relaxed">{jarvisResult.loan_verdict}</p>
                </div>
              )}

              {jarvisResult && jarvisResult.suggested_loan_amount_cents > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-2 text-left">
                  <div>
                    <p className="text-[7px] font-black text-violet-400 uppercase tracking-widest font-bold">Valor de Empréstimo Ótimo</p>
                    <p className="text-xs font-black text-emerald-400">{formatCurrency(jarvisResult.suggested_loan_amount_cents)}</p>
                  </div>

                  <button
                    onClick={() => {
                      if (jarvisResult) {
                        setSimulationType("INCOME");
                        setAmount((jarvisResult.suggested_loan_amount_cents / 100).toFixed(2).replace(".", ","));
                        setInstallments(1);
                        setIsLoan(false);
                        setJarvisResult(null);
                      }
                    }}
                    className="w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                    data-testid="jarvis-load-loan-button"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-black" />
                    Carregar Empréstimo Ótimo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
