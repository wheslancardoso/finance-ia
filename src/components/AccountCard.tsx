"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import GlassCard from "./GlassCard";
import { cn, formatCurrency } from "@/lib/utils";
import { CreditCard, Wallet, Banknote, CalendarDays } from "lucide-react";
import { useAccountModal } from "@/context/AccountModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ActionMenu } from "./ActionMenu";
import { PayInvoiceModal } from "./PayInvoiceModal";
import { ConfirmModal } from "./ConfirmModal";
import { StatusModal } from "./StatusModal";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { financialService } from "@/services/financialService";

interface AccountCardProps {
  account: any;
}

export function AccountCard({ account: initialAccount }: AccountCardProps) {
  const { accounts, deleteAccount, refreshData } = useFinancialData();
  const liveAccount = accounts.find(a => a.id === initialAccount.id) || initialAccount;
  
  const { 
    id, 
    name, 
    type, 
    color_hex: colorHex, 
    balance_cents: balance, 
    credit_limit_cents: limit,
    closing_day,
    due_day,
    current_invoice_cents
  } = liveAccount;

  const { openEdit } = useAccountModal();
  const isCreditCard = type === "CREDIT_CARD";
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; message: string; title: string; type: "success" | "error" }>({
    isOpen: false,
    message: "",
    title: "",
    type: "error"
  });
  const [migrationValue, setMigrationValue] = useState("");
  const [isMigrationLoading, setIsMigrationLoading] = useState(false);
  const [showMigrationInput, setShowMigrationInput] = useState(false);
  const [showAdjustmentInput, setShowAdjustmentInput] = useState(false);
  const [adjustmentValue, setAdjustmentValue] = useState("");

  // Detectar status da fatura
  const openAmount = liveAccount.open_invoice_cents || 0;
  const closedAmount = liveAccount.closed_invoice_cents || 0;
  
  // Se houver fatura fechada não paga, damos prioridade a ela na visualização principal
  // se a aberta ainda estiver pequena ou se o usuário estiver no período de fechamento.
  const hasClosedInvoice = isCreditCard && closedAmount > 0;

  // O balance_cents para CREDIT_CARD agora representa a dívida total acumulada (via trigger).
  const spent = isCreditCard ? Math.abs(balance) : Math.abs(balance);
  const available = (limit || 0) - spent;
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

  async function handleDelete() {
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    try {
      await deleteAccount(id);
    } catch (err) {
      setStatusModal({
        isOpen: true,
        title: "Erro na Exclusão",
        message: "Ocorreu um problema ao tentar excluir esta conta. Verifique sua conexão e tente novamente.",
        type: "error"
      });
    }
  }

  async function confirmMarkAsPaid() {
    setIsMigrationLoading(true);
    try {
      await financialService.payInvoice({
        creditCardAccountId: id,
        amountCents: closedAmount,
        alreadyPaid: true
      });
      refreshData();
    } catch (err) {
      console.error("Erro ao marcar como pago:", err);
    } finally {
      setIsMigrationLoading(false);
      setMarkPaidModalOpen(false);
    }
  }

  return (
    <>
    <GlassCard className="relative overflow-hidden group" data-testid={`account-card-${id}`}>
      <div 
        className="absolute -top-12 -right-12 w-24 h-24 blur-[60px] opacity-20 transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: colorHex }}
      />

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10"
            style={{ backgroundColor: `${colorHex}15` }}
          >
            {isCreditCard ? (
              <CreditCard className="w-6 h-6" style={{ color: colorHex }} />
            ) : type === "CASH" ? (
              <Banknote className="w-6 h-6" style={{ color: colorHex }} />
            ) : (
              <Wallet className="w-6 h-6" style={{ color: colorHex }} />
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg leading-none mb-1">{name}</h3>
            <span className="text-white/40 text-xs uppercase tracking-widest font-medium">
              {type === "CHECKING" ? "Conta Corrente" : 
               type === "SAVINGS" ? "Investimento" : 
               type === "CREDIT_CARD" ? "Cartão de Crédito" : "Dinheiro"}
            </span>
          </div>
        </div>
        
        <ActionMenu 
          onEdit={() => openEdit(liveAccount)}
          onDelete={handleDelete}
          className="relative z-10"
        />
      </div>

      <div className="space-y-4">
        {isCreditCard ? (() => {
          // Mostramos a fatura FECHADA se houver valor, senão a ABERTA.
          const showClosed = closedAmount > 0;
          const invoiceAmount = showClosed ? closedAmount : openAmount;
          const invoiceMonthRaw = showClosed
            ? (liveAccount.closed_invoice_month || "")
            : (liveAccount.open_invoice_month || "");
          
          // Formata o mês (YYYY-MM para MMM)
          let invoiceMonth = "---";
          if (invoiceMonthRaw) {
            try {
              const [y, m] = invoiceMonthRaw.split("-");
              // O reference_month já é o mês da fatura, não precisamos adicionar 1
              invoiceMonth = format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMM", { locale: ptBR });
            } catch (e) {
              invoiceMonth = invoiceMonthRaw;
            }
          }
          
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  showClosed ? "bg-red-400" : "bg-emerald-400 animate-pulse"
                )} />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                  Fatura {showClosed ? "Fechada" : "Aberta"} — {invoiceMonth}
                </p>
              </div>
              
              {showMigrationInput ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={migrationValue}
                    onChange={(e) => setMigrationValue(e.target.value)}
                    placeholder="Valor (ex: 250,00)"
                    autoFocus
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-lg font-bold text-white w-40 focus:outline-none focus:border-violet-500/50"
                  />
                  <button
                    disabled={isMigrationLoading}
                    onClick={async () => {
                      const cents = Math.round(parseFloat(migrationValue.replace(",", ".")) * 100);
                      if (isNaN(cents)) return;
                      setIsMigrationLoading(true);
                      const now = new Date();
                      // Se a fatura é a fechada do mês atual, usamos uma data antes do dia de fechamento
                      const migrationDate = new Date(now.getFullYear(), now.getMonth(), (closing_day || 5) - 1);
                      
                      await financialService.createMigrationBalanceTransaction({
                        user_id: liveAccount.user_id,
                        account_id: id,
                        amount_cents: cents,
                        description: `Saldo Inicial (${invoiceMonth})`,
                        date: migrationDate.toISOString(),
                        is_paid: false // Nasce como a pagar, o usuário clica em Pagar depois se quiser
                      });
                      
                      setIsMigrationLoading(false);
                      setShowMigrationInput(false);
                      setMigrationValue("");
                      window.dispatchEvent(new CustomEvent('financial-data-updated'));
                    }}
                    className="p-2 rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors"
                  >
                    <CalendarDays className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowMigrationInput(false)}
                    className="text-white/20 hover:text-white/40 text-xs font-bold uppercase"
                  >
                    X
                  </button>
                </div>
              ) : (
                <div className="flex items-baseline gap-3">
                  <h2 data-testid="invoice-amount" className="text-3xl font-bold tracking-tight tabular-nums text-amber-500">
                    {formatCurrency(invoiceAmount)}
                  </h2>
                  
                  {isCreditCard && (
                    <button 
                      onClick={() => {
                        setAdjustmentValue((invoiceAmount / 100).toString());
                        setShowAdjustmentInput(true);
                      }}
                      data-testid="adjust-invoice-button"
                      className="text-[9px] font-bold text-violet-400/60 uppercase tracking-widest hover:text-violet-400 transition-colors border-b border-violet-400/20"
                    >
                      {invoiceAmount === 0 ? "Informar Saldo" : "Reajustar"}
                    </button>
                  )}
                </div>
              )}

              {showAdjustmentInput && (
                <div className="flex flex-col gap-2 mt-2 p-3 bg-white/5 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Valor Real da Fatura</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(e.target.value)}
                      placeholder="0,00"
                      data-testid="invoice-adjustment-input"
                      autoFocus
                      className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-lg font-bold text-white w-full focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      disabled={isMigrationLoading}
                      onClick={async () => {
                        const targetCents = Math.round(parseFloat(adjustmentValue.replace(",", ".")) * 100);
                        if (isNaN(targetCents)) return;
                        
                        setIsMigrationLoading(true);
                        const diffCents = targetCents - invoiceAmount;
                        
                        try {
                          if (diffCents !== 0) {
                            const invoiceId = closedAmount > 0 
                              ? liveAccount.closed_invoice_id 
                              : liveAccount.open_invoice_id;

                            await financialService.adjustInvoiceBalance({
                              user_id: liveAccount.user_id,
                              account_id: id,
                              invoice_id: invoiceId,
                              amount_cents: diffCents,
                              description: "Ajuste de Saldo (Manual)",
                              date: new Date().toISOString()
                            });
                          }
                          setShowAdjustmentInput(false);
                          refreshData();
                        } catch (err) {
                          console.error("Erro ao ajustar saldo:", err);
                        } finally {
                          setIsMigrationLoading(false);
                        }
                      }}
                      data-testid="invoice-adjustment-save-button"
                      className="px-4 py-2 rounded-lg bg-violet-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-violet-600 transition-all disabled:opacity-50"
                    >
                      {isMigrationLoading ? "..." : "Salvar"}
                    </button>
                    <button 
                      onClick={() => setShowAdjustmentInput(false)}
                      className="p-2 text-white/20 hover:text-white/40 transition-colors"
                    >
                      X
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="space-y-1">
            <p className="text-white/40 text-sm font-medium">Saldo Atual</p>
            <h2 data-testid={`account-balance-${id}`} className="text-3xl font-bold tracking-tight tabular-nums text-white">
              {formatCurrency(balance)}
            </h2>
          </div>
        )}

        {isCreditCard && limit > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
              <span>Limite Utilizado</span>
              <span>{percentage.toFixed(0)}%</span>
            </div>
            <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full rounded-full bg-violet-500 transition-all duration-1000"
                style={{ width: `${percentage}%`, backgroundColor: colorHex }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-medium text-white/20">
                <span>Disponível: {formatCurrency(available)}</span>
                <span>Total: {formatCurrency(limit)}</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold text-violet-400/40 uppercase tracking-tight">
                <span>Dívida Total: {formatCurrency(liveAccount.total_debt_cents || spent)}</span>
                {liveAccount.next_month_impact_cents > 0 && (
                  <span className="text-emerald-400/50">Liberará {formatCurrency(liveAccount.next_month_impact_cents)} em breve</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
        {isCreditCard ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Fecha dia</span>
              <span className="text-xs font-bold text-white/60">{closing_day || "--"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Vence dia</span>
              <span className="text-xs font-bold text-white/60">{due_day || "--"}</span>
            </div>
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex }} />
        )}
        {isCreditCard && hasClosedInvoice ? (
          <div className="flex gap-2">
            <button
              disabled={isMigrationLoading}
              onClick={() => setMarkPaidModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest hover:bg-white/10 hover:text-amber-400/80 transition-all disabled:opacity-50"
              data-testid="mark-as-paid-button"
            >
              {isMigrationLoading ? "..." : "Já Paguei"}
            </button>
            <button
              onClick={() => setPayModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/20 text-[9px] font-black text-violet-400 uppercase tracking-widest hover:bg-violet-500/30 hover:text-violet-300 transition-all"
              data-testid="pay-invoice-button"
            >
              Pagar Agora
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
            Vesper Sync
          </span>
        )}
      </div>
    </GlassCard>

    {typeof document !== "undefined" && (
      <>
        {isCreditCard && payModalOpen && createPortal(
          <PayInvoiceModal
            isOpen={payModalOpen}
            onClose={() => setPayModalOpen(false)}
            creditCardAccount={liveAccount}
          />,
          document.body
        )}

        {createPortal(
          <ConfirmModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={confirmDelete}
            title="Excluir Conta"
            message={`Tem certeza que deseja excluir a conta "${name}"? Todas as transações vinculadas serão apagadas permanentemente.`}
            confirmText="Excluir"
            cancelText="Manter"
            variant="danger"
          />,
          document.body
        )}

        {createPortal(
          <ConfirmModal
            isOpen={markPaidModalOpen}
            onClose={() => setMarkPaidModalOpen(false)}
            onConfirm={confirmMarkAsPaid}
            title="Confirmar Pagamento Externo"
            message={`Você está confirmando que a fatura de ${formatCurrency(closedAmount)} já foi paga fora do sistema. Isso liberará seu limite sem gerar débitos em suas contas bancárias cadastradas.`}
            confirmText="Sim, já paguei"
            cancelText="Voltar"
            variant="info"
          />,
          document.body
        )}

        {createPortal(
          <StatusModal
            isOpen={statusModal.isOpen}
            onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
            title={statusModal.title}
            message={statusModal.message}
            type={statusModal.type}
          />,
          document.body
        )}
      </>
    )}
    </>
  );
}
