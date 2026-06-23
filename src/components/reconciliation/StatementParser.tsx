"use client";

import React, { useState } from "react";
import { parseBankStatement, ParsedBankTransaction } from "@/domain/financial/reconciliation-logic";
import { formatCurrency } from "@/lib/utils";
import { FileText, Wand2 } from "lucide-react";

interface StatementParserProps {
  onParsed: (transactions: ParsedBankTransaction[], rawText: string) => void;
}

export function StatementParser({ onParsed }: StatementParserProps) {
  const [text, setText] = useState("");

  const handleParse = () => {
    if (!text.trim()) return;
    const parsed = parseBankStatement(text);
    onParsed(parsed, text);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-violet-500/20 text-violet-400 rounded-2xl">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Extrato Bancário</h2>
          <p className="text-xs font-medium text-white/40">Cole o extrato do seu banco aqui para o Smart Match</p>
        </div>
      </div>

      <textarea
        className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none font-mono"
        placeholder="12/06/2026 PIX RECEBIDO R$ 150,00&#10;15/06 COMPRA DEBITO MERCADO 50,00"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex justify-end">
        <button
          onClick={handleParse}
          disabled={!text.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all active:scale-95"
        >
          <Wand2 className="w-4 h-4" />
          Analisar Extrato
        </button>
      </div>
    </div>
  );
}
