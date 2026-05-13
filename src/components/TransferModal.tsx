"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRightLeft, Landmark, Wallet, Check, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAccountModal } from "@/context/AccountModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import { StatusModal, type StatusType } from "./StatusModal";

export function TransferModal() {
  const { isTransferOpen, closeTransfer } = useAccountModal();
  const { accounts, createTransfer } = useFinancialData();
  
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: StatusType;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  // Dropdown states
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  const eligibleAccounts = accounts.filter(a => a.type !== 'CREDIT_CARD');

  useEffect(() => {
    if (isTransferOpen) {
      setAmount("");
      setFromAccountId(eligibleAccounts[0]?.id || "");
      setToAccountId(eligibleAccounts[1]?.id || "");
    }
  }, [isTransferOpen, accounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const amountCents = Math.round(parseFloat(amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setStatusModal({
        isOpen: true,
        title: "Valor Inválido",
        message: "Por favor, insira um valor válido para transferência.",
        type: "error"
      });
      return;
    }

    if (fromAccountId === toAccountId) {
      setStatusModal({
        isOpen: true,
        title: "Contas Idênticas",
        message: "A conta de origem e destino devem ser diferentes.",
        type: "error"
      });
      return;
    }

    const fromAccount = eligibleAccounts.find(a => a.id === fromAccountId);
    if (fromAccount && fromAccount.balance_cents < amountCents) {
      setStatusModal({
        isOpen: true,
        title: "Saldo Insuficiente",
        message: `Você não tem saldo suficiente na conta ${fromAccount.name} para esta transferência.`,
        type: "error"
      });
      return;
    }

    setLoading(true);
    try {
      await createTransfer(fromAccountId, toAccountId, amountCents);
      closeTransfer();
    } catch (error) {
      setStatusModal({
        isOpen: true,
        title: "Erro na Transferência",
        message: "Ocorreu um problema ao processar sua transferência. Tente novamente.",
        type: "error"
      });
    }
    setLoading(false);
  }

  return (
    <>
    <AnimatePresence>
      {isTransferOpen && (
        <div data-testid="transfer-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeTransfer}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Transferir Recursos</h2>
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">Movimentação entre Contas</p>
              </div>
              <button onClick={closeTransfer} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Valor da Transferência</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold">R$</span>
                  <input
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="transfer-amount-input"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-6 pl-12 pr-4 text-white text-3xl font-black outline-none focus:border-violet-500/50 transition-all tabular-nums"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Transfer Flow */}
              <div className="grid grid-cols-1 gap-4 relative">
                {/* From Account */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Origem</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenFrom(!openFrom)}
                      data-testid="transfer-from-account-select"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white flex items-center justify-between hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Wallet className="w-4 h-4 text-violet-400" />
                        <span className="font-bold">{eligibleAccounts.find(a => a.id === fromAccountId)?.name || "Selecionar Conta"}</span>
                      </div>
                    </button>
                    
                    <AnimatePresence>
                      {openFrom && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-10 w-full mt-2 bg-[#121212] border border-white/10 rounded-2xl p-2 shadow-2xl max-h-48 overflow-y-auto"
                        >
                          {eligibleAccounts.map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => { setFromAccountId(acc.id); setOpenFrom(false); }}
                              data-testid={`transfer-account-from-${acc.id}`}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl text-left text-sm transition-all flex items-center justify-between",
                                fromAccountId === acc.id ? "bg-violet-500 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <span>{acc.name}</span>
                              <span className="text-[10px] font-bold opacity-60">{formatCurrency(acc.balance_cents)}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex justify-center -my-2 relative z-0">
                  <div className="bg-violet-500 rounded-full p-2 shadow-lg shadow-violet-500/20">
                    <ArrowRightLeft className="w-4 h-4 text-white rotate-90" />
                  </div>
                </div>

                {/* To Account */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Destino</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenTo(!openTo)}
                      data-testid="transfer-to-account-select"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white flex items-center justify-between hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Landmark className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold">{eligibleAccounts.find(a => a.id === toAccountId)?.name || "Selecionar Conta"}</span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {openTo && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-10 w-full mt-2 bg-[#121212] border border-white/10 rounded-2xl p-2 shadow-2xl max-h-48 overflow-y-auto"
                        >
                          {eligibleAccounts.map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => { setToAccountId(acc.id); setOpenTo(false); }}
                              data-testid={`transfer-account-to-${acc.id}`}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl text-left text-sm transition-all flex items-center justify-between",
                                toAccountId === acc.id ? "bg-emerald-500 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <span>{acc.name}</span>
                              <span className="text-[10px] font-bold opacity-60">{formatCurrency(acc.balance_cents)}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="transfer-submit-button"
                className="w-full bg-white text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-violet-500 hover:text-white transition-all shadow-xl active:scale-95 disabled:opacity-50"
              >
                {loading ? "Processando..." : "Confirmar Transferência"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <StatusModal
      isOpen={statusModal.isOpen}
      onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
      title={statusModal.title}
      message={statusModal.message}
      type={statusModal.type}
    />
    </>
  );
}
