"use client";

import React, { useState, useEffect } from "react";
import { Calculator, AlertTriangle, CheckCircle2, XCircle, TrendingDown } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "./GlassCard";
import { useFinancialData } from "@/context/FinancialDataContext";

export default function SpendingSimulator() {
  const { simulatePurchaseImpact } = useFinancialData();
  const [amount, setAmount] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    const valueCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (isNaN(valueCents) || valueCents <= 0) return;

    setLoading(true);
    const res = await simulatePurchaseImpact(valueCents);
    setResult(res);
    setLoading(false);
  };

  useEffect(() => {
    if (amount === "") {
      setResult(null);
    } else {
      const timer = setTimeout(() => {
        handleSimulate();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [amount]);

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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="font-bold text-white tracking-tight">Simulador de Impacto</h3>
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-black">Previsão Inteligente</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold">R$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.]/g, ""))}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xl font-bold text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
          />
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Analisando Cenários...</p>
          </div>
        ) : result ? (
          <div className={cn("rounded-2xl border p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500", getStatusBg(result.status))}>
            <div className="flex items-center gap-3">
              {getStatusIcon(result.status)}
              <p className={cn("text-sm font-bold", getStatusColor(result.status))}>
                {result.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Novo Saldo Final</p>
                <p className="text-lg font-bold text-white">{formatCurrency(result.simulated_surplus_cents)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Impacto na Sobra</p>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <p className="text-lg font-bold text-rose-400">{result.impact_percentage}%</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center px-4">
            <p className="text-sm text-white/30 font-medium italic">
              "Digite um valor para ver como ele afeta seu planejamento para o fim do mês."
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
