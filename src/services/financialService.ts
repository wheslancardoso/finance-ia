import { db, type Transaction, type Account, type Goal, type Category, type RecurringTransaction, type Budget } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Helper: chama a API interna do Next.js
 */
async function apiFetch(path: string, options?: RequestInit) {
  console.log(`🌐 [API Fetch] ${options?.method || 'GET'} ${path}`);
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

export const financialService = {
  // --- TRANSACTIONS ---
  async upsertTransaction(data: any) {
    console.log("🚀 Iniciando upsertTransaction:", data.description, data.amount_cents);
    try {
      const txDate = new Date(data.date || new Date());
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const isPastMonth = txDate < currentMonthStart;

      const payload = {
        ...data,
        id: data.id || generateId(),
        is_paid: data.is_paid ?? (isPastMonth ? true : false),
        source: data.source ?? "MANUAL",
      };

      // 1. Persistir no PostgreSQL via API
      const saved = await apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      console.log("✅ Transação salva no PostgreSQL:", saved.id);

      // 2. Atualizar cache local (Dexie)
      await db.transactions.put({ ...payload, ...saved });
      return { data: saved, error: null };
    } catch (error: any) {
      console.error("❌ upsertTransaction falhou no PostgreSQL:", error.message);
      // Fallback: salvar apenas local
      const txDate = new Date(data.date || new Date());
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const isPastMonth = txDate < currentMonthStart;

      const payload = {
        ...data,
        id: data.id || generateId(),
        is_paid: data.is_paid ?? (isPastMonth ? true : false),
        source: data.source ?? "MANUAL",
      };
      await db.transactions.put(payload);
      console.warn("⚠️ Transação salva apenas localmente (Dexie)");
      return { data: payload, error };
    }
  },

  async deleteTransaction(id: string) {
    try {
      await apiFetch(`/api/transactions?id=${id}`, { method: "DELETE" });
      await db.transactions.delete(id);
      return { data: true, error: null };
    } catch (error) {
      console.error("❌ deleteTransaction error:", error);
      await db.transactions.delete(id);
      return { data: null, error };
    }
  },

  async deleteTransactionSeries(description: string, installmentTotal: number, accountId: string) {
    try {
      const transactions = await db.transactions
        .where({ account_id: accountId })
        .filter(t => t.description === description && t.installment_total === installmentTotal)
        .toArray();

      // Deletar cada uma via API
      for (const t of transactions) {
        await apiFetch(`/api/transactions?id=${t.id}`, { method: "DELETE" }).catch(() => {});
      }

      await db.transactions.bulkDelete(transactions.map(t => t.id));
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateTransactionSeries(
    description: string, 
    installmentTotal: number, 
    accountId: string,
    updates: Partial<Transaction>
  ) {
    try {
      const transactions = await db.transactions
        .where({ account_id: accountId })
        .filter(t => t.description === description && t.installment_total === installmentTotal)
        .toArray();
      
      const updated = transactions.map(t => ({ ...t, ...updates }));
      
      // Atualizar cada uma via API
      for (const t of updated) {
        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify(t),
        }).catch(() => {});
      }

      await db.transactions.bulkPut(updated);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createInstallmentSeries(data: {
    user_id: string;
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
  }) {
    console.log(`📦 Criando série de parcelamento: ${data.description} (${data.installments}x)`);
    try {
      const amountPerInstallment = Math.round(data.amount_total_cents / data.installments);
      const groupId = generateId();
      const transactions: Transaction[] = [];
      
      const now = new Date();
      for (let i = 0; i < data.installments; i++) {
        const date = new Date(data.start_date);
        date.setMonth(date.getMonth() + i);
        
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const isPastMonth = date < currentMonthStart;
        
        const tx: Transaction = {
          id: generateId(),
          user_id: data.user_id,
          description: `${data.description} (${i + 1}/${data.installments})`,
          amount_cents: amountPerInstallment,
          transaction_type: "EXPENSE",
          date: date.toISOString(),
          account_id: data.account_id,
          category_id: data.category_id,
          is_paid: isPastMonth,
          installment_current: i + 1,
          installment_total: data.installments,
          source: "MANUAL"
        };

        transactions.push(tx);
      }
      
      // Persistir cada parcela no PostgreSQL
      console.log(`⏳ Enviando ${transactions.length} parcelas para o servidor...`);
      for (const tx of transactions) {
        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify({ ...tx, installment_group_id: groupId }),
        }).catch((err) => console.error(`❌ Erro ao salvar parcela ${tx.installment_current}:`, err));
      }

      await db.transactions.bulkPut(transactions);
      console.log("✅ Todas as parcelas foram processadas.");
      return { data: true, error: null };
    } catch (error) {
      console.error("❌ Falha crítica ao criar série de parcelamento:", error);
      return { data: null, error };
    }
  },

  // --- ACCOUNTS ---
  async deleteAccount(id: string) {
    try {
      await apiFetch(`/api/accounts?id=${id}`, { method: "DELETE" });
      await db.accounts.delete(id);
      return { data: true, error: null };
    } catch (error) {
      console.error("❌ deleteAccount error:", error);
      await db.accounts.delete(id);
      return { data: null, error };
    }
  },

  async upsertAccount(data: any) {
    console.log("🏦 Iniciando upsertAccount:", data.name);
    try {
      const payload = {
        ...data,
        id: data.id || generateId()
      };

      // 1. Persistir no PostgreSQL via API
      const saved = await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      console.log("✅ Conta salva no PostgreSQL:", saved.id);

      // 2. Atualizar cache local (Dexie)
      await db.accounts.put({ ...payload, ...saved });
      return { data: saved, error: null };
    } catch (error: any) {
      console.error("❌ upsertAccount falhou no PostgreSQL:", error.message);
      // Fallback: salvar apenas local
      const payload = {
        ...data,
        id: data.id || generateId()
      };
      await db.accounts.put(payload);
      console.warn("⚠️ Conta salva apenas localmente (Dexie)");
      return { data: payload, error };
    }
  },

  // --- GOALS ---
  async upsertGoal(data: any) {
    try {
      const payload = {
        ...data,
        id: data.id || generateId()
      };

      // 1. Persistir no PostgreSQL via API
      const saved = await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // 2. Atualizar cache local (Dexie)
      await db.goals.put({ ...payload, ...saved });
      console.log("✅ Meta salva no PostgreSQL e Dexie:", saved.id);
      return { data: saved, error: null };
      const payload = { ...data, id: data.id || generateId() };
      await db.goals.put(payload);
      return { data: payload, error: null };
    }
  },

  async updateGoalBalance(goalId: string, currentAmountCents: number) {
    try {
      await db.goals.update(goalId, { current_amount_cents: currentAmountCents });
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async findGoalByName(name: string, userId: string) {
    try {
      const goal = await db.goals
        .where({ user_id: userId })
        .filter(g => g.name === name)
        .first();
      return { data: goal, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // --- TRANSFERS & OTHERS ---
  async createTransfer(data: {
    user_id: string;
    from_account_id: string;
    to_account_id: string;
    amount_cents: number;
  }) {
    try {
      const fromAccount = await db.accounts.get(data.from_account_id);
      const toAccount = await db.accounts.get(data.to_account_id);
      
      if (fromAccount && toAccount) {
        // Update account balances via API
        await apiFetch("/api/accounts", {
          method: "POST",
          body: JSON.stringify({
            ...fromAccount,
            balance_cents: fromAccount.balance_cents - data.amount_cents
          }),
        });
        await apiFetch("/api/accounts", {
          method: "POST",
          body: JSON.stringify({
            ...toAccount,
            balance_cents: (toAccount.balance_cents || 0) + data.amount_cents
          }),
        });

        // Update local cache
        await db.accounts.update(data.from_account_id, { balance_cents: fromAccount.balance_cents - data.amount_cents });
        await db.accounts.update(data.to_account_id, { balance_cents: (toAccount.balance_cents || 0) + data.amount_cents });
        
        // Record transaction
        const txPayload = {
          id: generateId(),
          user_id: data.user_id,
          description: `Transferência para ${toAccount.name}`,
          amount_cents: data.amount_cents,
          transaction_type: "TRANSFER",
          date: new Date().toISOString(),
          account_id: data.from_account_id,
          is_paid: true,
          source: "MANUAL"
        };

        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify(txPayload),
        }).catch(() => {});

        await db.transactions.put(txPayload as Transaction);
      }
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * getFinancialState — Busca o estado financeiro completo.
   * Prioridade: API (PostgreSQL) → Fallback para Dexie local.
   */
  async getFinancialState(userId: string) {
    try {
      // Buscar do PostgreSQL via API route
      const state = await apiFetch(`/api/financial-state?user_id=${userId}`);

      return { data: state, error: null };
    } catch (apiError: any) {
      console.warn("⚠️ API indisponível, usando dados locais (Dexie):", apiError.message);
      
      // Fallback: dados locais
      return this._getLocalFinancialState(userId);
    }
  },

  /**
   * Fallback local com Dexie (offline-first)
   */
  async _getLocalFinancialState(userId: string) {
      const goals = await db.goals.where('user_id').equals(userId).toArray();
      
      const accounts = await db.accounts.where('user_id').equals(userId).toArray();
      const categories = await db.categories.where('user_id').equals(userId).toArray();
      const recurring_transactions = await db.recurring_transactions.where('user_id').equals(userId).toArray();
      const budgets = await db.budgets.where('user_id').equals(userId).toArray();
      const transactions = await db.transactions.where('user_id').equals(userId).toArray();
      
      const accumulated_balance_cents = accounts.reduce((acc, account) => acc + (account.balance_cents || 0), 0);
      
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const recent_transactions = transactions.slice(0, 10);
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const month_transactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= firstDayOfMonth && d <= lastDayOfMonth;
      });
      
      let income = 0;
      let debit_expense = 0;
      let credit_expense = 0;
      let investments = 0;
      
      month_transactions.forEach(t => {
        if (t.transaction_type === 'INCOME') income += t.amount_cents;
        if (t.transaction_type === 'EXPENSE') {
          const acc = accounts.find(a => a.id === t.account_id);
          if (acc?.type === 'CREDIT_CARD') {
            credit_expense += t.amount_cents;
          } else {
            debit_expense += t.amount_cents;
          }
        }
      });
      
      let monthly_income_cents = 0;
      let fixed_expenses_cents = 0;
      let financial_health_score = 80;
      
      if (typeof window !== "undefined") {
        monthly_income_cents = parseInt(localStorage.getItem("vesper_monthly_income") || "0", 10);
        fixed_expenses_cents = parseInt(localStorage.getItem("vesper_fixed_expenses") || "0", 10);
        financial_health_score = parseInt(localStorage.getItem("vesper_health_score") || "80", 10);
      }
      
      return {
        data: {
          user_profile: {
            monthly_income_cents,
            fixed_expenses_cents,
            accumulated_balance_cents,
            financial_health_score,
          },
          categories,
          accounts,
          goals,
          recurring_transactions,
          budgets,
          recent_transactions,
          month_transactions,
          month_stats: {
            income,
            debit_expense,
            credit_expense,
            investments
          }
        },
        error: null
      };
    } catch (error) {
      console.error(error);
      return { data: null, error };
    }
  },

  async simulatePurchaseImpact(userId: string, amountCents: number) {
    try {
      const state = await this.getFinancialState(userId);
      const balance = state.data?.user_profile.accumulated_balance_cents || 0;
      const accounts = state.data?.accounts || [];
      
      const consolidatedDebt = accounts
        .filter((a: any) => a.type === "CREDIT_CARD")
        .reduce((sum: number, a: any) => sum + (a.closed_invoice_cents || 0) + (a.open_invoice_cents || 0), 0);
      
      const realSurplus = balance - consolidatedDebt;
      const newBalance = balance - amountCents;
      const newRealSurplus = realSurplus - amountCents;
      
      let status: "SAFE" | "WARNING" | "DANGER" = "SAFE";
      let message = "Você possui saldo suficiente.";

      if (newRealSurplus < 0) {
        status = "DANGER";
        message = "⚠️ Perigo: Esta compra aumentará sua dívida líquida. Você estará pagando crédito com crédito.";
      } else if (newBalance < (balance * 0.3)) {
        status = "WARNING";
        message = "Atenção: Esta compra consome grande parte da sua liquidez atual.";
      }
      
      return {
        data: {
          current_surplus_cents: balance,
          simulated_surplus_cents: newBalance,
          status,
          message,
          impact_percentage: balance > 0 ? Math.round((amountCents / balance) * 100) : 100
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getGoalRecommendations(userId: string) {
    try {
      const state = await this.getFinancialState(userId);
      const profile = state.data?.user_profile;
      const accounts = state.data?.accounts || [];
      const balance = profile?.accumulated_balance_cents || 0;
      
      // Calcular Dívida Consolidada para saber se temos "Sobra Real"
      const consolidatedDebt = accounts
        .filter((a: any) => a.type === "CREDIT_CARD")
        .reduce((sum: number, a: any) => sum + (a.closed_invoice_cents || 0) + (a.open_invoice_cents || 0), 0);
      
      const realSurplus = balance - consolidatedDebt;
      const goals = state.data?.goals || [];
      
      // Ordenar metas por prioridade e prazo
      const sortedGoals = [...goals].sort((a: any, b: any) => {
        if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0);
        return new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime();
      });

      // Alocamos 20% da Sobra Real se positiva, priorizando fundo de emergência se houver
      let remainingToAllocate = realSurplus > 0 ? Math.round(realSurplus * 0.2) : 0;
      
      const recommendations = sortedGoals.map((g: any, index: number) => {
        const remainingGoal = (g.target_cents || 0) - (g.current_cents || 0);
        const amount = Math.min(remainingToAllocate, remainingGoal);
        remainingToAllocate -= amount;
        
        const isNextPriority = index === 0;

        let advice = "";
        if (realSurplus < 0) {
          const debtToClear = Math.abs(realSurplus);
          advice = `⚠️ Alerta: Sua liquidez está negativa. Você precisa de ${formatCurrency(debtToClear)} adicionais para cobrir suas faturas atuais antes de focar nesta meta.`;
        } else if (isNextPriority && amount > 0) {
          advice = `🎯 Estratégia: Recomendamos aportar ${formatCurrency(amount)} aqui hoje para manter sua saúde financeira.`;
        } else if (realSurplus > 0) {
          advice = "⏳ Prioridade: Esta meta está na fila. Continue mantendo sua reserva antes de avançar para o próximo objetivo.";
        } else {
          advice = "🛑 Estabilize sua liquidez e pague suas faturas fechadas primeiro.";
        }

        return {
          goal_id: g.id,
          goal_name: g.name,
          recommended_amount_cents: amount,
          is_full_target: amount >= remainingGoal && remainingGoal > 0,
          advice
        };
      });
      
      return {
        data: {
          surplus_cents: balance,
          real_surplus_cents: realSurplus,
          recommendations
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async toggleTransactionPaid(transactionId: string, currentStatus: boolean) {
    try {
      // Buscar transação local
      const tx = await db.transactions.get(transactionId);
      if (tx) {
        const updated = { ...tx, is_paid: !currentStatus };
        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify(updated),
        }).catch(() => {});
        await db.transactions.update(transactionId, { is_paid: !currentStatus });
      }
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createMigrationBalanceTransaction(data: {
    user_id: string;
    account_id: string;
    amount_cents: number;
    description: string;
    date: string;
    is_paid: boolean;
  }) {
    console.log("🛠️ Criando transação de ajuste de migração:", data.description);
    return this.upsertTransaction({
      ...data,
      transaction_type: "EXPENSE",
      category_id: null, // Ajuste técnico
      source: "MIGRATION"
    });
  }
};
