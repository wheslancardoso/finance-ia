"use client";

import React, { useState, useMemo } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { Wallet, CalendarDays, Calendar, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "DAY" | "WEEK" | "MONTH";

export default function SurvivalHUD() {
  const { 
    monthlyIncomeCents, 
    fixedExpensesCents, 
    accounts,
    extraIncomeCents,
    currentMonthExpensesCents,
    recurringIncomeCents,
    recurringExpensesCents,
    accumulatedBalanceCents,
    scheduledIncomeCents,
    scheduledExpensesCents,
    cardDebtImpactCents,
    budgets,
    setMonthlyIncomeCents,
    setFixedExpensesCents
  } = useFinancialData();

  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");

  // Estado local para o formulário de setup
  const [setupIncome, setSetupIncome] = useState("");
  const [setupExpenses, setSetupExpenses] = useState("");

  // Matemática Base-Zero do Modo Crise
  const totalCreditCardImpact = useMemo(() => {
    return accounts
      .filter((acc) => acc.type === "CREDIT_CARD")
      .reduce((sum, acc) => {
        const closed = acc.closed_invoice_cents || 0;
        const open = acc.open_invoice_cents || 0;
        return sum + closed + open;
      }, 0);
  }, [accounts]);

  const netWorthCents = useMemo(() => {
    const liquidity = accounts
      .filter(a => a.type !== "CREDIT_CARD")
      .reduce((sum, a) => sum + (a.balance_cents || 0), 0);
    return liquidity - totalCreditCardImpact;
  }, [accounts, totalCreditCardImpact]);

  const survivalCeilingCents = useMemo(() => {
    // 1. O que temos agora (Liquidez)
    const currentLiquidity = accumulatedBalanceCents;

    // 2. O que ainda vai entrar este mês (Agendados)
    // Somamos a renda mensal base APENAS se não houver transações de INCOME este mês 
    // (Simulando que a renda base é o que se espera receber)
    // Para simplificar e ser "Dinâmico", vamos usar os agendados reais.
    const expectedIncome = scheduledIncomeCents;

    // 3. O que ainda vai sair este mês (Agendados + Faturas)
    const expectedOutflow = scheduledExpensesCents + cardDebtImpactCents;

    // 4. Reservas de Orçamento (O que prometemos não gastar)
    const remainingBudgets = budgets.reduce((sum, b) => {
      return sum + Math.max(0, (b.limit_cents || 0) - (b.spent_cents || 0));
    }, 0);

    // Teto = Liquidez + Entradas Agendadas - Saídas Agendadas - Faturas - Orçamentos
    const ceiling = currentLiquidity + expectedIncome - expectedOutflow - remainingBudgets;

    console.log("📊 [SurvivalHUD] Cálculo do Teto:", {
      liquidity: currentLiquidity / 100,
      expectedIncome: expectedIncome / 100,
      expectedOutflow: expectedOutflow / 100,
      remainingBudgets: remainingBudgets / 100,
      finalCeiling: ceiling / 100
    });

    return Math.max(0, ceiling);
  }, [
    accumulatedBalanceCents,
    scheduledIncomeCents,
    scheduledExpensesCents,
    cardDebtImpactCents,
    budgets
  ]);

  // Cálculos Temporais
  const getDisplayValue = () => {
    const today = new Date();
    // Dias restantes no mês (simplificado para 30 ou baseado no fim do mês real)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeft = Math.max(1, endOfMonth.getDate() - today.getDate() + 1);
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

    switch (viewMode) {
      case "DAY":
        return survivalCeilingCents / daysLeft;
      case "WEEK":
        return survivalCeilingCents / weeksLeft;
      case "MONTH":
      default:
        return survivalCeilingCents;
    }
  };

  const currentTeto = getDisplayValue();
  const formattedTeto = (currentTeto / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // Determinar Estado Visual
  const totalIncomeForStatus = monthlyIncomeCents + recurringIncomeCents;
  const percentageOfIncome = totalIncomeForStatus > 0 ? (survivalCeilingCents / totalIncomeForStatus) * 100 : 0;
  
  let statusColor = "text-emerald-400";
  let statusGlow = "shadow-[0_0_15px_rgba(16,185,129,0.3)]";
  let bgGradient = "from-emerald-500/10 to-transparent";
  let StatusIcon = ShieldCheck;
  let statusMessage = "Fluxo Estável";

  if (percentageOfIncome < 15) {
    statusColor = "text-red-400";
    statusGlow = "shadow-[0_0_15px_rgba(239,68,68,0.4)]";
    bgGradient = "from-red-500/10 to-transparent";
    StatusIcon = AlertTriangle;
    statusMessage = "Sobrevivência Crítica";
  } else if (percentageOfIncome < 35) {
    statusColor = "text-amber-400";
    statusGlow = "shadow-[0_0_15px_rgba(245,158,11,0.3)]";
    bgGradient = "from-amber-500/10 to-transparent";
    StatusIcon = AlertTriangle;
    statusMessage = "Atenção ao Orçamento";
  }

  // Se a renda total (manual + recorrente) não estiver configurada, mostramos o setup
  if (monthlyIncomeCents + recurringIncomeCents === 0) {
    return (
      <div className="w-full bg-[#0a0a0a]/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white/80 font-bold mb-1">Ativar Modo Crise</h3>
            <p className="text-sm text-white/40 max-w-sm">
              Configure sua renda e seus custos fixos para ativar o Teto de Sobrevivência Dinâmico.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Renda Mensal (Ex: 3000,00)" 
            className="w-full sm:w-48 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
            value={setupIncome}
            onChange={(e) => setSetupIncome(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="Custo Fixo (Ex: 1500,00)" 
            className="w-full sm:w-48 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
            value={setupExpenses}
            onChange={(e) => setSetupExpenses(e.target.value)}
          />
          <button 
            onClick={() => {
              const incomeCents = parseFloat(setupIncome.replace(/\./g, "").replace(",", ".")) * 100;
              const expensesCents = parseFloat(setupExpenses.replace(/\./g, "").replace(",", ".")) * 100;
              if (incomeCents > 0) {
                setMonthlyIncomeCents(incomeCents || 0);
                setFixedExpensesCents(expensesCents || 0);
              }
            }}
            className="bg-white text-black font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 transition-colors"
          >
            Ativar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden mb-8 ${statusGlow} transition-all duration-500`}>
      {/* Background Gradient Effect */}
      <div className={`absolute inset-0 bg-gradient-to-b ${bgGradient} opacity-50 pointer-events-none`}></div>
      
      <div className="relative p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        
        {/* Left Side: Information */}
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-black/50 border border-white/10 ${statusColor}`}>
            <StatusIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Teto de Sobrevivência</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border bg-black/40 ${percentageOfIncome < 15 ? 'border-red-500/30 text-red-400' : 'border-white/10 text-white/40'}`}>
                {statusMessage}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl md:text-4xl font-bold tracking-tight ${statusColor}`}>
                {formattedTeto}
              </span>
              <span className="text-sm font-medium text-white/30 lowercase">/ {viewMode.toLowerCase()}</span>
            </div>
            
            {/* Net Worth Insight */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Patrimônio Líquido:</span>
              <span className={cn(
                "text-[10px] font-black tabular-nums",
                netWorthCents >= 0 ? "text-emerald-500/60" : "text-red-500/60"
              )}>
                {(netWorthCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              {netWorthCents < 0 && (
                <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-tighter">Ciclo de Dívida</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Salvation Goal for "Break the Cycle" */}
        {netWorthCents < 0 && (
          <div className="hidden lg:flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[200px]">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Meta de Salvação
            </span>
            <span className="text-xl font-black text-amber-400 tabular-nums">
              {((Math.abs(netWorthCents)) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            <p className="text-[8px] text-white/40 mt-1 text-center font-medium leading-tight">
              Quanto você precisa para pagar <br/> tudo e ter R$ 0,00 real.
            </p>
          </div>
        )}

        {/* Right Side: Toggles and Math Summary */}
        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
          {/* Toggles */}
          <div className="flex p-1 bg-black/40 border border-white/5 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setViewMode("DAY")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === "DAY" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Dia
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === "WEEK" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Sem
            </button>
            <button
              onClick={() => setViewMode("MONTH")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === "MONTH" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <Wallet className="w-3.5 h-3.5" /> Mês
            </button>
          </div>

          {/* Math Summary Miniature */}
          <div className="flex flex-wrap items-center justify-end gap-2 text-[9px] text-white/30 font-mono">
            <div className="flex items-center gap-1">
              <span className="text-white/10">RENDA:</span>
              <span title="Renda (Base + Recorrente)" className="text-emerald-500/70">
                {((monthlyIncomeCents + recurringIncomeCents) / 100).toFixed(0)}
              </span>
            </div>
            {(accumulatedBalanceCents > 0 || extraIncomeCents > 0) && (
              <div className="flex items-center gap-1">
                <span className="text-white/20">+</span>
                <span title="Bicos e Sobras" className="text-blue-400/70">
                  {((accumulatedBalanceCents + extraIncomeCents) / 100).toFixed(0)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-white/20">-</span>
              <span className="text-white/10">FIXO:</span>
              <span title="Custo Fixo (Base + Recorrente)" className="text-white/40">
                {((fixedExpensesCents + recurringExpensesCents) / 100).toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/20">-</span>
              <span className="text-white/10">MÊS:</span>
              <span title="Débitos/Pix Já Feitos" className="text-orange-400/70">
                {(currentMonthExpensesCents / 100).toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/20">-</span>
              <span className="text-white/10">CARTÃO:</span>
              <span title="Faturas Fechadas + Abertas" className="text-red-500/70">
                {((accounts.filter(a => a.type === 'CREDIT_CARD').reduce((s, a) => s + (a.closed_invoice_cents || 0) + (a.open_invoice_cents || 0), 0)) / 100).toFixed(0)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
