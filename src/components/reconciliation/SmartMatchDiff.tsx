"use client";

import React, { useState } from "react";
import { MatchResult, ParsedBankTransaction } from "@/domain/financial/reconciliation-logic";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Plus } from "lucide-react";

interface SmartMatchDiffProps {
  matchResult: MatchResult;
  onAddMissingToVesper: (tx: ParsedBankTransaction) => void;
}

export function SmartMatchDiff({ matchResult, onAddMissingToVesper }: SmartMatchDiffProps) {
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const handleAdd = (tx: ParsedBankTransaction) => {
    setAddingIds(prev => new Set(prev).add(tx.id));
    onAddMissingToVesper(tx);
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2 bg-emerald-500/20 rounded-full">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Matches Perfeitos</div>
            <div className="text-xl font-black text-emerald-400">{matchResult.exactMatches.length}</div>
          </div>
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Faltando no App</div>
            <div className="text-xl font-black text-amber-400">{matchResult.missingInVesper.length}</div>
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2 bg-red-500/20 rounded-full">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-red-400/70">Não consta no Extrato</div>
            <div className="text-xl font-black text-red-400">{matchResult.missingInBank.length}</div>
          </div>
        </div>
      </div>

      {/* Tabelas de Diff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Lado do App (Vesper) */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-white uppercase tracking-widest px-2">No Aplicativo</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            {matchResult.exactMatches.map((m, i) => (
              <div key={`v-match-${i}`} className="p-3 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white/90">{m.vesper.description}</span>
                    <span className="text-[10px] font-medium text-white/40">{new Date(m.vesper.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <span className="text-xs font-black tabular-nums text-emerald-400">
                  {m.vesper.transaction_type === 'INCOME' ? '+' : '-'}{formatCurrency(m.vesper.amount_cents)}
                </span>
              </div>
            ))}

            {matchResult.missingInBank.map((v, i) => (
              <div key={`v-miss-${i}`} className="p-3 flex items-center justify-between bg-red-500/5">
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white/90">{v.description}</span>
                    <span className="text-[10px] font-medium text-white/40">{new Date(v.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <span className="text-xs font-black tabular-nums text-red-400">
                  {v.transaction_type === 'INCOME' ? '+' : '-'}{formatCurrency(v.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lado do Banco */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-white uppercase tracking-widest px-2">No Extrato Bancário</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            {matchResult.exactMatches.map((m, i) => (
              <div key={`b-match-${i}`} className="p-3 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white/90">{m.bank.description}</span>
                    <span className="text-[10px] font-medium text-white/40">{m.bank.date.toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <span className="text-xs font-black tabular-nums text-emerald-400">
                  {m.bank.type === 'INCOME' ? '+' : '-'}{formatCurrency(m.bank.amount_cents)}
                </span>
              </div>
            ))}

            {matchResult.missingInVesper.map((b, i) => (
              <div key={`b-miss-${b.id}`} className="p-3 flex flex-col gap-2 bg-amber-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/90">{b.description}</span>
                      <span className="text-[10px] font-medium text-white/40">{b.date.toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <span className="text-xs font-black tabular-nums text-amber-400">
                    {b.type === 'INCOME' ? '+' : '-'}{formatCurrency(b.amount_cents)}
                  </span>
                </div>
                
                <button
                  onClick={() => handleAdd(b)}
                  disabled={addingIds.has(b.id)}
                  className="mt-1 flex items-center justify-center gap-2 w-full py-1.5 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {addingIds.has(b.id) ? "Adicionado" : "Adicionar ao App"}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
