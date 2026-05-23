import { db, type Transaction, type Account, type Goal, type Category, type RecurringTransaction, type Budget } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { calculateTotalConsolidatedDebt, calculateAccumulatedBalance } from "@/domain/financial/financial-logic";

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
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(path, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `API error ${res.status}`);
    }
    return res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API timeout exceeded');
    }
    throw error;
  }
}

export const financialService = {
  // --- USER PROFILE ---
  async upsertUserProfile(data: { id: string; monthly_income_cents?: number; fixed_expenses_cents?: number; gamification_enabled?: boolean }) {
    try {
      const saved = await apiFetch("/api/user-profile", {
        method: "POST",
        body: JSON.stringify(data),
      });

      // Bypass para Testes E2E: Atualiza o mock global
      if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__) {
        const mock = (window as any).__E2E_MOCK_STATE__;
        mock.user_profile = { ...mock.user_profile, ...data };
      }

      return { data: saved, error: null };
    } catch (error: any) {
      console.error("❌ upsertUserProfile failed:", error.message);
      return { data: null, error };
    }
  },

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

      // Bypass para Testes E2E: Atualiza o mock global
      if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__) {
        const mock = (window as any).__E2E_MOCK_STATE__;
        const index = (mock.transactions || []).findIndex((t: any) => t.id === payload.id);
        if (index >= 0) mock.transactions[index] = { ...mock.transactions[index], ...payload };
        else (mock.transactions = mock.transactions || []).push(payload);

        // Atualizar saldo da conta no mock se for cartão
        if (mock.accounts) {
          const acc = mock.accounts.find((a: any) => a.id === payload.account_id);
          if (acc && acc.type === 'CREDIT_CARD') {
            const isExpense = payload.transaction_type === 'EXPENSE';
            const delta = isExpense ? payload.amount_cents : -payload.amount_cents;
            // Simplificação para E2E: assume que tudo vai pra fatura fechada se estivermos testando migração
            acc.closed_invoice_cents = (acc.closed_invoice_cents || 0) + delta;
            acc.balance_cents = (acc.balance_cents || 0) - delta;
          }
        }
      }

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
        amount: (data.amount_cents || 0) / 100,
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
      // 1. Chamar a API para deletar a série inteira (em lote) no Supabase remoto
      const params = new URLSearchParams({
        description,
        installment_total: installmentTotal.toString(),
        account_id: accountId
      });
      await apiFetch(`/api/transactions?${params.toString()}`, { method: "DELETE" });

      // 2. Deletar do IndexedDB local as que estiverem presentes no cache local
      const transactions = await db.transactions
        .where({ account_id: accountId })
        .filter(t => t.description === description && t.installment_total === installmentTotal)
        .toArray();

      if (transactions.length > 0) {
        await db.transactions.bulkDelete(transactions.map(t => t.id));
      }

      // Suporte a E2E Mock State
      if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__) {
        const mock = (window as any).__E2E_MOCK_STATE__;
        if (mock.transactions) {
          mock.transactions = mock.transactions.filter(
            (t: any) => !(t.description === description && t.installment_total === installmentTotal && t.account_id === accountId)
          );
        }
      }

      return { data: true, error: null };
    } catch (error) {
      console.error("❌ deleteTransactionSeries error:", error);
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
    starting_installment?: number;
    is_third_party?: boolean;
    third_party_name?: string | null;
  }) {
    const startingInstallment = data.starting_installment || 1;
    console.log(`📦 Criando série de parcelamento: ${data.description} (${data.installments}x) iniciando na ${startingInstallment}ª`);
    try {
      const amountPerInstallment = Math.round(data.amount_total_cents / data.installments);
      const groupId = generateId();
      const transactions: Transaction[] = [];
      
      const now = new Date();
      const startDate = new Date(data.start_date);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const startDay = startDate.getDate();
      const startHours = startDate.getHours();
      const startMinutes = startDate.getMinutes();
      const startSeconds = startDate.getSeconds();
      const startMs = startDate.getMilliseconds();

      for (let i = startingInstallment - 1; i < data.installments; i++) {
        // Cálculo de mês e ano de destino com clamping de data seguro
        const targetMonthTotal = startMonth + (i - (startingInstallment - 1));
        const targetYear = startYear + Math.floor(targetMonthTotal / 12);
        const targetMonth = targetMonthTotal % 12;
        
        // Obter o último dia do mês de destino para evitar overflow de dia do mês
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const finalDay = Math.min(startDay, lastDayOfTargetMonth);
        
        // Criar objeto de data final preservando as horas e milissegundos
        const date = new Date(targetYear, targetMonth, finalDay, startHours, startMinutes, startSeconds, startMs);
        
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const isPastMonth = date < currentMonthStart;
        
        const tx: Transaction = {
          id: generateId(),
          user_id: data.user_id,
          description: data.description,
          amount_cents: amountPerInstallment,
          transaction_type: "EXPENSE",
          date: date.toISOString(),
          account_id: data.account_id,
          category_id: data.category_id,
          is_paid: isPastMonth,
          installment_current: i + 1,
          installment_total: data.installments,
          source: "MANUAL",
          is_third_party: data.is_third_party,
          third_party_name: data.third_party_name
        };

        transactions.push(tx);
      }
      
      // Persistir cada parcela no PostgreSQL
      console.log(`⏳ Enviando ${transactions.length} parcelas para o servidor...`);
      for (const tx of transactions) {
        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify({ ...tx, installment_group_id: groupId }),
        }).catch((err) => {
          console.error(`❌ Erro ao salvar parcela ${tx.installment_current}:`, err);
          throw err;
        });
      }

      await db.transactions.bulkPut(transactions);
      
      // Suporte a E2E Mock State
      if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__) {
        const mock = (window as any).__E2E_MOCK_STATE__;
        mock.transactions = [...(mock.transactions || []), ...transactions];
      }

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

      // Bypass para Testes E2E: Atualiza o mock global
      if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__) {
        const mock = (window as any).__E2E_MOCK_STATE__;
        const index = (mock.accounts || []).findIndex((a: any) => a.id === payload.id);
        if (index >= 0) mock.accounts[index] = { ...mock.accounts[index], ...payload };
        else (mock.accounts = mock.accounts || []).push(payload);
      }

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
    } catch (error: any) {
      console.error("❌ upsertGoal falhou no PostgreSQL:", error.message);
      const fallbackPayload = { ...data, id: data.id || generateId() };
      await db.goals.put(fallbackPayload);
      return { data: fallbackPayload, error };
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
      // Se estivermos em teste (mockId presente) ou se o erro for apenas de rede, 
      // tentamos o fallback local. Se não houver userId, aí sim falha.
      if (!userId) {
        throw new Error("Usuário não identificado");
      }
      return this._getLocalFinancialState(userId);
    }
  },

  /**
   * Fallback local com Dexie (offline-first)
   */
  async _getLocalFinancialState(userId: string) {
    try {
      const goals = await db.goals.where('user_id').equals(userId).toArray();
      
      const accounts = await db.accounts.where('user_id').equals(userId).toArray();
      const categories = await db.categories.where('user_id').equals(userId).toArray();
      const recurring_transactions = await db.recurring_transactions.where('user_id').equals(userId).toArray();
      const budgets = await db.budgets.where('user_id').equals(userId).toArray();
      const rawTransactions = await db.transactions.where('user_id').equals(userId).toArray();
      const transactions = rawTransactions.map(t => ({
        ...t,
        amount_cents: Number(t.amount_cents || 0),
        amount: (Number(t.amount_cents || 0) / 100)
      }));
      
      const accumulated_balance_cents = calculateAccumulatedBalance(accounts);
      
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
        const amt = Number(t.amount_cents || 0);
        if (t.transaction_type === 'INCOME') income += amt;
        if (t.transaction_type === 'EXPENSE') {
          const acc = accounts.find(a => a.id === t.account_id);
          if (acc?.type === 'CREDIT_CARD') {
            credit_expense += amt;
          } else {
            debit_expense += amt;
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
        const target_amount_cents = g.target_amount_cents || g.target_cents || 0;
        const current_amount_cents = g.current_amount_cents || g.current_cents || 0;
        const remainingGoal = target_amount_cents - current_amount_cents;
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
  },

  async adjustInvoiceBalance(data: {
    user_id: string;
    account_id: string;
    invoice_id: string;
    amount_cents: number;
    description: string;
    date: string;
  }) {
    console.log("🛠️ Criando transação de ajuste de fatura:", data.description);
    return this.upsertTransaction({
      ...data,
      transaction_type: data.amount_cents >= 0 ? "EXPENSE" : "INCOME",
      amount_cents: Math.abs(data.amount_cents),
      category_id: null,
      is_adjustment: true,
      is_paid: false,
      source: "ADJUSTMENT"
    });
  },

  async payInvoice(params: {
    creditCardAccountId: string;
    paymentAccountId?: string;
    amountCents: number;
    alreadyPaid?: boolean;
  }) {
    console.log("💳 Iniciando pagamento de fatura:", params.creditCardAccountId);
    try {
      const result = await apiFetch("/api/accounts/pay-invoice", {
        method: "POST",
        body: JSON.stringify(params),
      });

      console.log("✅ Pagamento de fatura processado via API");
      // No mock para testes, atualizamos o estado local
      if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__) {
        const mock = (window as any).__E2E_MOCK_STATE__;
        // Limpar faturas fechadas da conta e transações vinculadas
        if (mock.accounts) {
          const acc = mock.accounts.find((a: any) => a.id === params.creditCardAccountId);
          if (acc) {
            acc.closed_invoice_cents = 0;
            // Se for pagamento total ou migração, o balance (dívida) diminui
            if (params.alreadyPaid) {
               acc.balance_cents = (acc.balance_cents || 0) + params.amountCents;
            }
          }
        }
        // Marcar transações do cartão como pagas no mock
        if (mock.transactions) {
          mock.transactions = mock.transactions.map((t: any) => 
            (t.account_id === params.creditCardAccountId && !t.is_paid) 
            ? { ...t, is_paid: true } 
            : t
          );
        }
      }

      return { data: result, error: null };
    } catch (error: any) {
      console.error("❌ payInvoice falhou:", error.message);
      return { data: null, error };
    }
  },

  // --- RECURRING TRANSACTIONS ---
  async upsertRecurringTransaction(data: any) {
    console.log("🔁 Iniciando upsertRecurringTransaction:", data.description);
    try {
      const payload = {
        ...data,
        id: data.id || generateId()
      };

      const saved = await apiFetch("/api/recurring-transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await db.recurring_transactions.put({ ...payload, ...saved });
      return { data: saved, error: null };
    } catch (error: any) {
      console.error("❌ upsertRecurringTransaction falhou:", error.message);
      const fallbackPayload = { ...data, id: data.id || generateId() };
      await db.recurring_transactions.put(fallbackPayload);
      return { data: fallbackPayload, error };
    }
  },

  async deleteRecurringTransaction(id: string) {
    try {
      await apiFetch(`/api/recurring-transactions?id=${id}`, { method: "DELETE" });
      await db.recurring_transactions.delete(id);
      return { data: true, error: null };
    } catch (error) {
      console.error("❌ deleteRecurringTransaction error:", error);
      await db.recurring_transactions.delete(id);
      return { data: null, error };
    }
  },

  async toggleRecurringStatus(id: string, currentStatus: string) {
    try {
      const sub = await db.recurring_transactions.get(id);
      if (!sub) throw new Error("Fluxo não encontrado");

      const newStatus = currentStatus === "active" ? "paused" : "active";
      const updated = { ...sub, status: newStatus };

      const saved = await apiFetch("/api/recurring-transactions", {
        method: "POST",
        body: JSON.stringify(updated),
      });

      await db.recurring_transactions.put({ ...updated, ...saved });
      return { data: saved, error: null };
    } catch (error: any) {
      console.error("❌ toggleRecurringStatus error:", error);
      return { data: null, error };
    }
  },

  async skipRecurringOccurrence(recurringId: string, monthKey: string) {
    console.log(`⏭️ Pulando ocorrência ${monthKey} do fluxo ${recurringId}`);
    try {
      const recurring = await db.recurring_transactions.get(recurringId);
      if (!recurring) throw new Error("Fluxo não encontrado");

      const excluded_months = Array.from(new Set([...(recurring.excluded_months || []), monthKey]));
      const updated = { ...recurring, excluded_months };

      const saved = await apiFetch("/api/recurring-transactions", {
        method: "POST",
        body: JSON.stringify(updated),
      });

      await db.recurring_transactions.put({ ...updated, ...saved });
      return { data: saved, error: null };
    } catch (error: any) {
      console.error("❌ skipRecurringOccurrence falhou:", error.message);
      return { data: null, error };
    }
  },

  // --- IA INTEGRATIONS ---
  async analyzeSimulationIA(simulation: any, summary: any) {
    try {
      const res = await apiFetch("/api/ia", {
        method: "POST",
        body: JSON.stringify({
          action: "analyze-simulation",
          simulation,
          financial_summary: summary
        }),
      });
      return { data: res.advice, error: null };
    } catch (error: any) {
      console.error("❌ analyzeSimulationIA failed:", error.message);
      return { data: null, error };
    }
  },

  async solveFinancialDilemma(text: string, summary: any) {
    try {
      const res = await apiFetch("/api/ia", {
        method: "POST",
        body: JSON.stringify({
          action: "generate-scenario",
          text,
          financial_summary: summary
        }),
      });
      return { data: res, error: null };
    } catch (error: any) {
      console.error("❌ solveFinancialDilemma failed:", error.message);
      return { data: null, error };
    }
  },

  async optimizeSweep(goals: any[], budgets: any[], summary: any) {
    try {
      const res = await apiFetch("/api/ia", {
        method: "POST",
        body: JSON.stringify({
          action: "optimize-sweep",
          goals,
          budgets,
          financial_summary: summary
        }),
      });
      return { data: res, error: null };
    } catch (error: any) {
      console.error("❌ optimizeSweep failed:", error.message);
      return { data: null, error };
    }
  },

  async consultJarvisIA(params: {
    goals?: any[];
    budgets?: any[];
    accounts?: any[];
    transactions?: any[];
    recurring_transactions?: any[];
    summary?: any;
    simulation?: any;
  }) {
    try {
      const res = await apiFetch("/api/ia", {
        method: "POST",
        body: JSON.stringify({
          action: "jarvis-advisor",
          goals: params.goals,
          budgets: params.budgets,
          accounts: params.accounts,
          transactions: params.transactions,
          recurring_transactions: params.recurring_transactions,
          financial_summary: params.summary,
          simulation: params.simulation
        }),
      });
      return { data: res, error: null };
    } catch (error: any) {
      console.error("❌ consultJarvisIA failed:", error.message);
      return { data: null, error };
    }
  }
};
