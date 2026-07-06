"use client";

import React, { useState, useMemo } from "react";
import { StatementParser } from "./StatementParser";
import { SmartMatchDiff } from "./SmartMatchDiff";
import { smartMatch, ParsedBankTransaction, VesperTransaction } from "@/domain/financial/reconciliation-logic";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Building2, LockKeyhole, Loader2 } from "lucide-react";

interface ReconciliationClientProps {
  initialAccounts: any[];
  initialTransactions: any[];
}

export function ReconciliationClient({ initialAccounts, initialTransactions }: ReconciliationClientProps) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccounts[0]?.id || "");
  const [parsedBankTxs, setParsedBankTxs] = useState<ParsedBankTransaction[]>([]);
  const [bankFinalBalance, setBankFinalBalance] = useState<string>("");
  const [reconciliationDate, setReconciliationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isReconciling, setIsReconciling] = useState(false);

  // Filtra as transações do app pela conta selecionada
  const vesperTxs = useMemo(() => {
    return initialTransactions
      .filter(t => t.account_id === selectedAccountId)
      .map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount_cents: t.amount_cents,
        transaction_type: t.transaction_type
      })) as VesperTransaction[];
  }, [initialTransactions, selectedAccountId]);

  const selectedAccount = initialAccounts.find(a => a.id === selectedAccountId);
  
  // Roda o smartMatch sempre que o extrato mudar
  const matchResult = useMemo(() => {
    if (!parsedBankTxs.length) return null;
    return smartMatch(vesperTxs, parsedBankTxs);
  }, [vesperTxs, parsedBankTxs]);

  const handleParsed = (txs: ParsedBankTransaction[]) => {
    setParsedBankTxs(txs);
  };

  const handleAddMissingToVesper = async (tx: ParsedBankTransaction) => {
    // Adiciona transação faltante ao backend (simplificado para o MVP)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedAccountId,
          amount_cents: tx.amount_cents,
          transaction_type: tx.type,
          date: tx.date.toISOString(),
          description: tx.description,
          source: "RECONCILIATION"
        })
      });
      if (res.ok) {
        router.refresh(); // recarrega initialTransactions
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentAppBalanceCents = selectedAccount?.balance_cents || 0;
  
  // Limpa o input do banco (R$ 1.500,50 -> 150050)
  const targetBankBalanceCents = useMemo(() => {
    const clean = bankFinalBalance.replace(/[^\d,\.-]/g, '').replace(/\./g, '').replace(',', '.');
    const float = parseFloat(clean);
    if (isNaN(float)) return null;
    return Math.round(float * 100);
  }, [bankFinalBalance]);

  const differenceCents = targetBankBalanceCents !== null 
    ? targetBankBalanceCents - currentAppBalanceCents 
    : null;

  const handleReconcile = async () => {
    if (targetBankBalanceCents === null || !selectedAccountId) return;
    
    setIsReconciling(true);
    try {
      // Define o horário para o final do dia selecionado
      const targetDate = new Date(reconciliationDate + "T23:59:59");
      
      const res = await fetch("/api/accounts/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedAccountId,
          current_app_balance_cents: currentAppBalanceCents,
          target_bank_balance_cents: targetBankBalanceCents,
          date: targetDate.toISOString()
        })
      });
      
      if (res.ok) {
        // Selar o mês com o saldo confirmado pelo usuário
        const [year, month] = reconciliationDate.split("-");
        const referenceMonth = `${year}-${month}`;
        
        try {
          await fetch("/api/month-closing", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reference_month: referenceMonth,
              total_balance_cents: targetBankBalanceCents,
              seal_method: "reconciliation"
            })
          });
        } catch (sealErr) {
          console.warn("Falha ao selar mês via month-closing:", sealErr);
        }

        alert("Reconciliação concluída com sucesso! O saldo foi ajustado e o mês foi selado.");
        router.refresh();
        setParsedBankTxs([]);
        setBankFinalBalance("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Seleção de Conta e Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[32px] p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/5 text-white/70 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-white tracking-tight">Qual Conta?</h2>
              <p className="text-xs font-medium text-white/40">Selecione a conta para conciliar</p>
            </div>
          </div>
          
          <select 
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="" disabled>Selecione uma conta...</option>
            {initialAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} (App: R$ {formatCurrency(a.balance_cents)})</option>
            ))}
          </select>
        </div>

        <StatementParser onParsed={handleParsed} />
      </div>

      {matchResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SmartMatchDiff 
            matchResult={matchResult} 
            onAddMissingToVesper={handleAddMissingToVesper} 
          />
        </div>
      )}

      {/* Trava Final: Ajuste de Saldo */}
      <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl md:rounded-[32px] p-4 md:p-8 space-y-4 md:space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 md:p-4 bg-violet-600 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(124,58,237,0.4)]">
            <LockKeyhole className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Lacrar Mês</h2>
            <p className="text-xs md:text-sm font-medium text-white/60">Informe o saldo exato que está no app do banco agora</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-black text-white uppercase tracking-widest px-2">Data do Saldo</label>
              <input 
                type="date" 
                value={reconciliationDate}
                onChange={e => setReconciliationDate(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3 md:px-5 md:py-4 text-white text-lg font-mono focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div className="flex-[2] space-y-2">
              <label className="text-xs font-black text-white uppercase tracking-widest px-2">Saldo Final no Banco</label>
              <input 
                type="text" 
                placeholder="Ex: 1500,00"
                value={bankFinalBalance}
                onChange={e => setBankFinalBalance(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3 md:px-5 md:py-4 text-white text-lg md:text-xl font-mono focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 w-full p-4 bg-black/20 rounded-2xl border border-white/5 flex flex-col justify-center">
            <span className="text-xs font-bold text-white/40 mb-1">Diferença Encontrada</span>
            {differenceCents !== null ? (
              <span className={`text-xl md:text-2xl font-black tabular-nums ${differenceCents === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {differenceCents > 0 ? '+' : ''}{formatCurrency(differenceCents)}
              </span>
            ) : (
              <span className="text-xl font-bold text-white/20">--</span>
            )}
          </div>

          <button
            onClick={handleReconcile}
            disabled={isReconciling || targetBankBalanceCents === null}
            className="w-full px-6 py-3.5 md:px-8 md:py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white rounded-2xl font-black text-sm md:text-base transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {isReconciling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Lacrar & Ajustar Saldo</>
            )}
          </button>
        </div>
        
        {differenceCents !== null && differenceCents !== 0 && (
          <div className="text-xs md:text-sm font-medium text-amber-400/80 bg-amber-500/10 p-3 md:p-4 rounded-xl">
            <strong>Atenção:</strong> Ao lacrar o mês, uma transação de reconciliação no valor de {formatCurrency(Math.abs(differenceCents))} será criada automaticamente para forçar o saldo do aplicativo a bater com o do banco.
          </div>
        )}
      </div>

    </div>
  );
}
