"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { db } from "@/lib/db";
import { cn, formatCurrency } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  Clock, 
  Calendar,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  User,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ThirdPartyGroup {
  name: string;
  balanceCents: number;
  totalExpensesCents: number;
  totalIncomesCents: number;
  transactions: any[];
}

export default function ThirdPartiesPage() {
  const { accounts, loading: contextLoading } = useFinancialData();
  const { userId } = useAccountModal();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/transactions?user_id=${userId}&limit=1000`);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        } else {
          // Fallback Dexie local
          const localData = await db.transactions
            .where('user_id')
            .equals(userId)
            .toArray();
          
          const localCategories = await db.categories.where('user_id').equals(userId).toArray();
          const localAccounts = await db.accounts.where('user_id').equals(userId).toArray();
          
          const catMap = new Map(localCategories.map(c => [c.id, c]));
          const accMap = new Map(localAccounts.map(a => [a.id, a]));
          
          const mappedData = localData.map((t: any) => ({
            ...t,
            category: catMap.get(t.category_id),
            account: accMap.get(t.account_id),
            category_name: t.category_name || catMap.get(t.category_id)?.name,
            category_type: t.category_type || catMap.get(t.category_id)?.type,
          }));

          mappedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(mappedData as any);
        }
      } catch (err) {
        console.error("Erro ao buscar transações no Dexie local:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [userId]);

  // Agrupar transações por terceiro
  const thirdPartyGroups = useMemo(() => {
    const groups: Record<string, ThirdPartyGroup> = {};

    transactions.forEach(tx => {
      if (!tx.is_third_party || !tx.third_party_name) return;

      const name = tx.third_party_name.trim();
      if (!groups[name]) {
        groups[name] = {
          name,
          balanceCents: 0,
          totalExpensesCents: 0,
          totalIncomesCents: 0,
          transactions: []
        };
      }

      groups[name].transactions.push(tx);

      const amount = Number(tx.amount_cents) || 0;
      if (tx.transaction_type === "EXPENSE") {
        groups[name].totalExpensesCents += amount;
        groups[name].balanceCents += amount; // Gastei para o terceiro (ele me deve)
      } else if (tx.transaction_type === "INCOME") {
        groups[name].totalIncomesCents += amount;
        groups[name].balanceCents -= amount; // Terceiro me pagou (abate a dívida)
      }
    });

    // Ordenar transações em cada grupo por data decrescente
    Object.values(groups).forEach(g => {
      g.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return Object.values(groups).sort((a, b) => b.balanceCents - a.balanceCents);
  }, [transactions]);

  // Estatísticas Consolidadas
  const stats = useMemo(() => {
    let totalToReceiveCents = 0;
    let totalToPayCents = 0;
    let activeDebtorsCount = 0;

    thirdPartyGroups.forEach(g => {
      if (g.balanceCents > 0) {
        totalToReceiveCents += g.balanceCents;
        activeDebtorsCount++;
      } else if (g.balanceCents < 0) {
        totalToPayCents += Math.abs(g.balanceCents);
      }
    });

    return {
      totalToReceiveCents,
      totalToPayCents,
      activeDebtorsCount
    };
  }, [thirdPartyGroups]);

  if (loading || contextLoading) {
    return (
      <div className="p-4 md:p-12 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/20"></div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-12 pt-0 md:p-12 max-w-7xl mx-auto w-full space-y-8 overflow-x-hidden animate-in fade-in duration-500">
      
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
              Recebíveis & Terceiros
            </h1>
            <p className="text-xs text-white/40">
              Controle de compras emprestadas, cartões divididos e saldos de devedores
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-6 flex items-center justify-between border-violet-500/10">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">Total a Receber</span>
            <h2 className="text-2xl md:text-3xl font-black text-white tabular-nums">
              {formatCurrency(stats.totalToReceiveCents)}
            </h2>
            <p className="text-[10px] text-white/30 font-medium">De {stats.activeDebtorsCount} contatos ativos</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </GlassCard>
 
        <GlassCard className="p-6 flex items-center justify-between border-emerald-500/10">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Total a Pagar</span>
            <h2 className="text-2xl md:text-3xl font-black text-white tabular-nums">
              {formatCurrency(stats.totalToPayCents)}
            </h2>
            <p className="text-[10px] text-white/30 font-medium">Saldos negativos com terceiros</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </GlassCard>
 
        <GlassCard className="p-6 flex items-center justify-between border-white/5">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block">Balanço Geral</span>
            <h2 className={cn(
              "text-2xl md:text-3xl font-black tabular-nums",
              (stats.totalToReceiveCents - stats.totalToPayCents) >= 0 ? "text-violet-400" : "text-emerald-400"
            )}>
              {formatCurrency(stats.totalToReceiveCents - stats.totalToPayCents)}
            </h2>
            <p className="text-[10px] text-white/30 font-medium">Saldo líquido de repasses</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 border border-white/10">
            <TrendingUp className="w-6 h-6" />
          </div>
        </GlassCard>
      </div>

      {/* Lista de Contatos */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-white/40 uppercase tracking-widest px-2">Saldos por Pessoa</h3>
        
        {thirdPartyGroups.length === 0 ? (
          <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-4 border-dashed border-white/10">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20 border border-white/10">
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum gasto de terceiro registrado</h4>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                No modal de Adicionar Transação, ative a opção "Lançamento de Terceiro" e coloque o nome de quem te deve para gerenciar recebíveis aqui!
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="grid gap-4">
            {thirdPartyGroups.map(group => {
              const isExpanded = expandedName === group.name;
              const hasDebt = group.balanceCents > 0;
              const isSettled = group.balanceCents === 0;

              return (
                <div key={group.name} className="relative group">
                  <GlassCard 
                    className={cn(
                      "p-4 md:p-6 transition-all duration-300 border-white/10 hover:border-white/20",
                      isExpanded ? "rounded-b-none border-violet-500/20 bg-white/[0.06] shadow-xl" : "shadow-md"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
                      {/* Avatar e Nome */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                          hasDebt 
                            ? "bg-violet-500/10 border-violet-500/20 text-violet-400" 
                            : isSettled 
                              ? "bg-white/5 border-white/10 text-white/30" 
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        )}>
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider truncate">
                            {group.name}
                          </h4>
                          <span className="text-[10px] text-white/40 font-bold block uppercase tracking-wider">
                            {group.transactions.length} lançamentos
                          </span>
                        </div>
                      </div>

                      {/* Fluxos Totais (Despesas e Pixs) */}
                      <div className="hidden md:flex items-center gap-8 ml-auto mr-12 tabular-nums text-xs">
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">Gastei por ela</span>
                          <span className="font-bold text-white">{formatCurrency(group.totalExpensesCents)}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">Recebi de volta</span>
                          <span className="font-bold text-white">{formatCurrency(group.totalIncomesCents)}</span>
                        </div>
                      </div>

                      {/* Status / Ações */}
                      <div className="flex items-center gap-4 ml-auto md:ml-0">
                        <div className="text-right">
                          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Saldo Atual</span>
                          <span className={cn(
                            "text-sm md:text-base font-black tabular-nums",
                            hasDebt 
                              ? "text-violet-400" 
                              : isSettled 
                                ? "text-white/40" 
                                : "text-emerald-400"
                          )}>
                            {isSettled ? "Quitado" : formatCurrency(group.balanceCents)}
                          </span>
                        </div>

                        <button
                          onClick={() => setExpandedName(isExpanded ? null : group.name)}
                          className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all"
                        >
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Detalhes Expansíveis (Histórico de Lançamentos) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-10 border-x border-b border-white/10 bg-black/40 rounded-b-[24px] overflow-hidden"
                      >
                        <div className="p-4 md:p-6 space-y-4">
                          <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Histórico de Movimentações</span>
                            {hasDebt && (
                              <span className="text-[9px] text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-400/20">
                                Aguardando PIX de reembolso
                              </span>
                            )}
                          </div>

                          <div className="grid gap-2">
                            {group.transactions.map((tx: any) => {
                              const isExpense = tx.transaction_type === "EXPENSE";
                              return (
                                <div 
                                  key={tx.id}
                                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all text-xs"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                      isExpense ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                                    )}>
                                      {isExpense ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-white">{tx.description}</h5>
                                      <div className="flex items-center gap-2 text-[9px] text-white/30">
                                        <span className="font-medium">
                                          {format(new Date(tx.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                                        </span>
                                        <span>•</span>
                                        <span className="font-bold uppercase tracking-wider text-white/40">
                                          {tx.account?.name || "Conta"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className={cn(
                                      "font-black tabular-nums",
                                      isExpense ? "text-white" : "text-emerald-400"
                                    )}>
                                      {isExpense ? "-" : "+"}{formatCurrency(tx.amount_cents)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
