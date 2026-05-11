"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, Wallet, Check, Loader2, ChevronDown } from "lucide-react";
import { financialService } from "@/services/financialService";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusModal } from "./StatusModal";

interface PayInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCardAccount: any;
}

export function PayInvoiceModal({ isOpen, onClose, creditCardAccount }: PayInvoiceModalProps) {
  const { accounts, refreshData } = useFinancialData();
  const router = useRouter();

  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    status: "success" | "error" | "info";
    title: string;
    message: string;
  }>({
    isOpen: false,
    status: "info",
    title: "",
    message: "",
  });

  const debitAccounts = accounts.filter(a => a.type !== "CREDIT_CARD");
  const invoiceAmount = creditCardAccount?.closed_invoice_cents || 0;
  const invoiceMonth = creditCardAccount?.closed_invoice_month || "---";

  React.useEffect(() => {
    if (isOpen && creditCardAccount) {
      setPaymentAmount((invoiceAmount / 100).toFixed(2).replace(".", ","));
      setSelectedAccountId(debitAccounts[0]?.id || "");
      setSuccess(false);
    }
  }, [isOpen, creditCardAccount]);

  // Pagar agora: marca como pago + debita da conta
  async function handlePayInvoice() {
    if (!selectedAccountId || !paymentAmount || !creditCardAccount) return;
    setLoading(true);

    const paymentCents = Math.round(parseFloat(paymentAmount.replace(",", ".")) * 100);

    const { error } = await financialService.payInvoice({
      creditCardAccountId: creditCardAccount.id,
      paymentAccountId: selectedAccountId,
      amountCents: paymentCents,
      alreadyPaid: false
    });

    if (error) {
      console.error("Erro ao pagar fatura:", error);
      setLoading(false);
      setStatusModal({
        isOpen: true,
        status: "error",
        title: "Erro no Pagamento",
        message: error.message || "Não foi possível registrar o pagamento da fatura."
      });
    } else {
      setLoading(false);
      await finishSuccess();
    }
  }

  // Já paguei: só marca como pago, sem debitar
  async function handleAlreadyPaid() {
    setLoading(true);
    const paymentCents = Math.round(parseFloat(paymentAmount.replace(",", ".")) * 100);

    const { error } = await financialService.payInvoice({
      creditCardAccountId: creditCardAccount.id,
      amountCents: paymentCents,
      alreadyPaid: true
    });

    if (!error) {
      setLoading(false);
      await finishSuccess();
    } else {
      setLoading(false);
      setStatusModal({
        isOpen: true,
        status: "error",
        title: "Erro na Fatura",
        message: error.message || "Não foi possível marcar a fatura como paga."
      });
    }
  }

  async function finishSuccess() {
    setSuccess(true);
    setTimeout(() => { onClose(); setSuccess(false); }, 1500);
    await refreshData();
    router.refresh();
  }

  const selectedAccount = debitAccounts.find(a => a.id === selectedAccountId);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              data-testid="pay-invoice-modal"
              className="relative w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white tracking-tight">Pagar Fatura</h2>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3 h-3 text-white/20" />
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
                    {creditCardAccount?.name} — {invoiceMonth}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Valor */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Valor do Pagamento</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold">R$</span>
                  <input
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white text-xl font-bold outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <p className="text-[9px] text-white/20 font-bold px-1">
                  Fatura fechada: {formatCurrency(invoiceAmount)}
                </p>
              </div>

              {/* Conta de Débito */}
              <div className="space-y-2 relative">
                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Debitar de</label>
                <div
                  onClick={() => setOpenDropdown(!openDropdown)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm text-white font-bold flex justify-between items-center cursor-pointer hover:border-white/20 transition-all"
                >
                  <span className="flex items-center gap-2">
                    {selectedAccount ? (
                      <>
                        <Wallet className="w-4 h-4 text-white/30" />
                        {selectedAccount.name}
                        <span className="text-white/20 text-xs tabular-nums">
                          ({formatCurrency(selectedAccount.balance_cents)})
                        </span>
                      </>
                    ) : "Selecione"}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", openDropdown && "rotate-180")} />
                </div>

                <AnimatePresence>
                  {openDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 left-0 right-0 top-full mt-2 bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto"
                    >
                      {debitAccounts.map(acc => (
                        <div
                          key={acc.id}
                          onClick={() => { setSelectedAccountId(acc.id); setOpenDropdown(false); }}
                          className={cn(
                            "px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-center justify-between",
                            acc.id === selectedAccountId && "bg-violet-500/10 text-violet-300"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-white/20" />
                            {acc.name}
                          </span>
                          <span className="text-xs text-white/30 tabular-nums">{formatCurrency(acc.balance_cents)}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botões */}
              <div className="space-y-3">
                  <button
                    onClick={handlePayInvoice}
                    disabled={loading || !selectedAccountId || !paymentAmount || success}
                    className={cn(
                      "w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2",
                      success
                        ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                        : "bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-xl disabled:opacity-40"
                    )}
                    data-testid="confirm-payment-button"
                  >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : success ? (
                    <div data-testid="payment-success-message" className="flex items-center gap-2">
                      <Check className="w-4 h-4" /> Pago com Sucesso
                    </div>
                  ) : (
                    "Pagar Agora"
                  )}
                </button>

                {!success && (
                  <button
                    onClick={handleAlreadyPaid}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-violet-400/50 hover:text-violet-300 bg-violet-500/5 border border-violet-500/20 hover:border-violet-500/40 transition-all"
                  >
                    Já Paguei (Liberar Limite)
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={() => {
          setStatusModal(prev => ({ ...prev, isOpen: false }));
          if (statusModal.status === "success") {
            onClose();
            router.refresh();
          }
        }}
        type={statusModal.status}
        title={statusModal.title}
        message={statusModal.message}
      />
    </AnimatePresence>
  );
}
