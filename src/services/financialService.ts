import { createClient } from "@/utils/supabase/client";
import { type Transaction } from "@/lib/db";

export const financialService = {
  // --- TRANSACTIONS ---
  
  async upsertTransaction(data: any) {
    const supabase = createClient();
    
    const payload = {
      ...data,
      is_paid: data.is_paid ?? true,
      source: data.source ?? "MANUAL",
    };

    if (data.id) {
      return await supabase.from("transactions").update(payload).eq("id", data.id);
    } else {
      return await supabase.from("transactions").insert([payload]);
    }
  },

  async deleteTransaction(id: string) {
    const supabase = createClient();
    return await supabase.from("transactions").delete().eq("id", id);
  },

  async deleteTransactionSeries(description: string, installmentTotal: number, accountId: string) {
    const supabase = createClient();
    return await supabase
      .from("transactions")
      .delete()
      .eq("description", description)
      .eq("installment_total", installmentTotal)
      .eq("account_id", accountId);
  },

  async updateTransactionSeries(
    description: string, 
    installmentTotal: number, 
    accountId: string,
    updates: Partial<Transaction>
  ) {
    const supabase = createClient();
    return await supabase
      .from("transactions")
      .update(updates)
      .eq("description", description)
      .eq("installment_total", installmentTotal)
      .eq("account_id", accountId);
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
    const supabase = createClient();
    return await supabase.rpc('create_installment_series', {
      p_user_id: data.user_id,
      p_description: data.description,
      p_amount_total_cents: data.amount_total_cents,
      p_installments: data.installments,
      p_account_id: data.account_id,
      p_category_id: data.category_id,
      p_start_date: data.start_date
    });
  },

  // --- ACCOUNTS ---

  async upsertAccount(data: any) {
    const supabase = createClient();
    if (data.id) {
      return await supabase.from("accounts").update(data).eq("id", data.id);
    } else {
      return await supabase.from("accounts").insert([data]);
    }
  },

  // --- GOALS ---

  async upsertGoal(data: any) {
    const supabase = createClient();
    if (data.id) {
      return await supabase.from("goals").update(data).eq("id", data.id);
    } else {
      return await supabase.from("goals").insert([data]);
    }
  },

  async updateGoalBalance(goalId: string, currentAmountCents: number) {
    const supabase = createClient();
    return await supabase.from("goals").update({ current_amount_cents: currentAmountCents }).eq("id", goalId);
  },

  async findGoalByName(name: string, userId: string) {
    const supabase = createClient();
    return await supabase
      .from("goals")
      .select("*")
      .eq("name", name)
      .eq("user_id", userId)
      .maybeSingle();
  },

  // --- TRANSFERS & OTHERS ---

  async createTransfer(data: {
    user_id: string;
    from_account_id: string;
    to_account_id: string;
    amount_cents: number;
  }) {
    const supabase = createClient();
    return await supabase.rpc('create_transfer', {
      p_user_id: data.user_id,
      p_from_id: data.from_account_id,
      p_to_id: data.to_account_id,
      p_amount_cents: data.amount_cents
    });
  },



  async getFinancialState(userId: string) {
    const supabase = createClient();
    return await supabase.rpc('get_financial_state_v5', { 
      p_user_id: userId 
    });
  },

  async simulatePurchaseImpact(userId: string, amountCents: number) {
    const supabase = createClient();
    return await supabase.rpc('fn_simulate_spending', {
      p_user_id: userId,
      p_amount_cents: amountCents
    });
  },

  async getGoalRecommendations(userId: string) {
    const supabase = createClient();
    return await supabase.rpc('fn_get_goal_recommendations', {
      p_user_id: userId
    });
  },

  async toggleTransactionPaid(transactionId: string, currentStatus: boolean) {
    const supabase = createClient();
    return await supabase
      .from("transactions")
      .update({ is_paid: !currentStatus })
      .eq("id", transactionId);
  }
};
