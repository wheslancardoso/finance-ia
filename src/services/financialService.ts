import { db, type Transaction, type Account, type Goal, type Category, type RecurringTransaction, type Budget } from "@/lib/db";
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const financialService = {
  // --- TRANSACTIONS ---
  async upsertTransaction(data: any) {
    try {
      const payload = {
        ...data,
        id: data.id || generateId(),
        is_paid: data.is_paid ?? true,
        source: data.source ?? "MANUAL",
      };

      await db.transactions.put(payload);
      return { data: payload, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteTransaction(id: string) {
    try {
      await db.transactions.delete(id);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteTransactionSeries(description: string, installmentTotal: number, accountId: string) {
    try {
      const transactions = await db.transactions
        .where({ account_id: accountId })
        .filter(t => t.description === description && t.installment_total === installmentTotal)
        .toArray();
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
    try {
      const amountPerInstallment = Math.round(data.amount_total_cents / data.installments);
      const transactions: Transaction[] = [];
      
      for (let i = 0; i < data.installments; i++) {
        const date = new Date(data.start_date);
        date.setMonth(date.getMonth() + i);
        
        transactions.push({
          id: generateId(),
          user_id: data.user_id,
          description: `${data.description} (${i + 1}/${data.installments})`,
          amount_cents: amountPerInstallment,
          transaction_type: "EXPENSE",
          date: date.toISOString(),
          account_id: data.account_id,
          category_id: data.category_id,
          is_paid: i === 0 ? true : false,
          installment_current: i + 1,
          installment_total: data.installments,
          source: "MANUAL"
        });
      }
      
      await db.transactions.bulkPut(transactions);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // --- ACCOUNTS ---
  async upsertAccount(data: any) {
    try {
      const payload = {
        ...data,
        id: data.id || generateId()
      };
      await db.accounts.put(payload);
      return { data: payload, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // --- GOALS ---
  async upsertGoal(data: any) {
    try {
      const payload = {
        ...data,
        id: data.id || generateId()
      };
      await db.goals.put(payload);
      return { data: payload, error: null };
    } catch (error) {
      return { data: null, error };
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
        // Update account balances
        await db.accounts.update(data.from_account_id, { balance_cents: fromAccount.balance_cents - data.amount_cents });
        await db.accounts.update(data.to_account_id, { balance_cents: (toAccount.balance_cents || 0) + data.amount_cents });
        
        // Record transaction
        await db.transactions.put({
          id: generateId(),
          user_id: data.user_id,
          description: `Transferência para ${toAccount.name}`,
          amount_cents: data.amount_cents,
          transaction_type: "TRANSFER",
          date: new Date().toISOString(),
          account_id: data.from_account_id,
          is_paid: true,
          source: "MANUAL"
        });
      }
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getFinancialState(userId: string) {
    try {
      // Local calculations
      const accounts = await db.accounts.where('user_id').equals(userId).toArray();
      const categories = await db.categories.where('user_id').equals(userId).toArray();
      const goals = await db.goals.where('user_id').equals(userId).toArray();
      const recurring_transactions = await db.recurring_transactions.where('user_id').equals(userId).toArray();
      const budgets = await db.budgets.where('user_id').equals(userId).toArray();
      const transactions = await db.transactions.where('user_id').equals(userId).toArray();
      
      // Calculate accumulated balance
      const accumulated_balance_cents = accounts.reduce((acc, account) => acc + (account.balance_cents || 0), 0);
      
      // Sort transactions by date desc
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const recent_transactions = transactions.slice(0, 10);
      
      // Filter this month's transactions
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const month_transactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= firstDayOfMonth && d <= lastDayOfMonth;
      });
      
      // Calculate month stats
      let income = 0;
      let debit_expense = 0;
      let credit_expense = 0;
      let investments = 0;
      
      month_transactions.forEach(t => {
        if (t.transaction_type === 'INCOME') income += t.amount_cents;
        if (t.transaction_type === 'EXPENSE') {
          // simple approximation for credit vs debit
          const acc = accounts.find(a => a.id === t.account_id);
          if (acc?.type === 'CREDIT_CARD') {
            credit_expense += t.amount_cents;
          } else {
            debit_expense += t.amount_cents;
          }
        }
      });
      
      // Load user profile from localStorage
      let monthly_income_cents = 0;
      let fixed_expenses_cents = 0;
      let financial_health_score = 0;
      
      if (typeof window !== "undefined") {
        monthly_income_cents = parseInt(localStorage.getItem("vesper_monthly_income") || "0", 10);
        fixed_expenses_cents = parseInt(localStorage.getItem("vesper_fixed_expenses") || "0", 10);
        financial_health_score = parseInt(localStorage.getItem("vesper_health_score") || "80", 10); // default 80
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
      
      const newBalance = balance - amountCents;
      const status = newBalance < 0 ? "DANGER" : (newBalance < 100000 ? "WARNING" : "SAFE"); // <1000 BRL is warning
      
      return {
        data: {
          current_surplus_cents: balance,
          simulated_surplus_cents: newBalance,
          status,
          message: status === "SAFE" ? "Você possui saldo suficiente." : "Atenção: Saldo ficará negativo ou baixo.",
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
      const balance = state.data?.user_profile.accumulated_balance_cents || 0;
      
      const goals = state.data?.goals || [];
      const recommendations = goals.map(g => ({
        goal_id: g.id,
        goal_name: g.name,
        recommended_amount_cents: Math.round(balance * 0.1), // suggest 10%
        is_full_target: false
      }));
      
      return {
        data: {
          surplus_cents: balance,
          remaining_surplus_cents: balance,
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
      await db.transactions.update(transactionId, { is_paid: !currentStatus });
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};
