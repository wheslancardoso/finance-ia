"use client";

import React from "react";
import { motion } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Utensils, 
  Car, 
  Gamepad, 
  Activity, 
  Briefcase, 
  TrendingUp, 
  ShoppingBag, 
  Home, 
  CreditCard,
  Wallet,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

import { InstallmentTimelineModal } from "./InstallmentTimelineModal";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  amount_cents?: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  transaction_type: "EXPENSE" | "INCOME" | "TRANSFER";
  category_id?: string;
  installment_current?: number;
  installment_total?: number;
  account_id?: string;
  category?: {
    name: string;
    color_hex: string;
  };
  account?: {
    id: string;
    name: string;
    type: string;
  };
}

interface TransactionTimelineProps {
  transactions: Transaction[];
}

const getIcon = (description: string, categoryName: string, type: string) => {
  const desc = description.toLowerCase();
  const name = categoryName?.toLowerCase() || "";
  
  // Marketplaces & Lojas
  if (desc.includes("amazon") || desc.includes("shopee") || desc.includes("mercado livre") || desc.includes("magalu")) return ShoppingBag;
  
  // Categorias
  if (name.includes("alimento") || name.includes("comer") || name.includes("restaurante")) return Utensils;
  if (name.includes("transporte") || name.includes("uber") || name.includes("carro")) return Car;
  if (name.includes("lazer") || name.includes("game") || name.includes("diversão")) return Gamepad;
  if (name.includes("saúde") || name.includes("médico") || name.includes("farmácia")) return Activity;
  if (name.includes("salário") || name.includes("trampo") || name.includes("job")) return Briefcase;
  if (name.includes("invest") || name.includes("rendimento")) return TrendingUp;
  if (name.includes("compras") || name.includes("shop")) return ShoppingBag;
  if (name.includes("moradia") || name.includes("aluguel") || name.includes("casa")) return Home;
  
  return type === "INCOME" ? ArrowUpRight : ArrowDownRight;
};

export function TransactionTimeline({ transactions }: TransactionTimelineProps) {
  const [selectedTx, setSelectedTx] = React.useState<Transaction | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = React.useState(false);

  // Agrupar transações por data
  const groups = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => {
    const dateKey = format(new Date(tx.date), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(tx);
    return acc;
  }, {});

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <Layers className="w-8 h-8 text-white/10" />
        </div>
        <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Nenhuma atividade recente</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8 space-y-10 pb-4">
      {/* Linha Vertical de Neon */}
      <div className="absolute left-[11px] top-2 bottom-0 w-[2px] bg-gradient-to-b from-violet-500/50 via-violet-500/20 to-transparent" />

      {sortedDates.map((dateKey, groupIndex) => {
        const date = new Date(dateKey);
        const dateLabel = isToday(date) 
          ? "Hoje" 
          : isYesterday(date) 
            ? "Ontem" 
            : format(date, "dd 'de' MMMM", { locale: ptBR });

        return (
          <div key={dateKey} className="relative">
            {/* Marcador de Data */}
            <div className="flex items-center gap-3 mb-6">
              <div className="absolute -left-[30px] w-6 h-6 rounded-full bg-[#0A0A0A] border-2 border-violet-500/50 flex items-center justify-center z-10 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
              </div>
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                {dateLabel}
              </h4>
            </div>

            <div className="space-y-4">
              {groups[dateKey].map((tx, txIndex) => {
                const Icon = getIcon(tx.description, tx.category?.name || "", tx.type);
                const isInstallment = tx.installment_total && tx.installment_total > 1;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (groupIndex * 0.1) + (txIndex * 0.05) }}
                    className="group relative"
                  >
                    <div 
                      onClick={() => {
                        if (isInstallment) {
                          setSelectedTx(tx);
                          setIsTimelineOpen(true);
                        }
                      }}
                      className={cn(
                        "bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/5 hover:border-white/10 p-4 rounded-[2rem] transition-all duration-300 flex items-center justify-between shadow-lg hover:shadow-violet-500/5",
                        isInstallment && "cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {/* Ícone com Glow */}
                        <div 
                          className="w-10 h-10 rounded-2xl flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${tx.category?.color_hex || '#333'}15` }}
                        >
                          <div 
                            className="absolute inset-0 opacity-20 blur-lg"
                            style={{ backgroundColor: tx.category?.color_hex || '#333' }}
                          />
                          <Icon 
                            className="w-5 h-5 relative z-10" 
                            style={{ color: tx.category?.color_hex || '#fff' }} 
                          />
                        </div>

                        <div className="space-y-1">
                          <h5 className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors">
                            {tx.description}
                          </h5>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                              {tx.account?.name || "Conta"}
                            </span>
                            {isInstallment && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                <Layers className="w-2.5 h-2.5 text-violet-400/50" />
                                <span className="text-[8px] font-bold text-violet-400/60 tracking-tighter">
                                  {tx.installment_current}/{tx.installment_total}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className={cn(
                          "text-sm font-black tabular-nums",
                          tx.type === "INCOME" ? "text-emerald-400" : "text-white"
                        )}>
                          {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
                        </p>
                        <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest group-hover:text-white/20 transition-colors">
                          {format(new Date(tx.date), "dd/MM - HH:mm")}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedTx && (
        <InstallmentTimelineModal 
          isOpen={isTimelineOpen}
          onClose={() => setIsTimelineOpen(false)}
          transaction={selectedTx}
        />
      )}
    </div>
  );
}
