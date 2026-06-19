import Dexie, { type Table } from 'dexie';

export interface Category {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  user_id?: string;
  color_hex?: string;
  icon_name?: string;
  is_system_default?: boolean;
  ignore_dashboard?: boolean;
  ignore_reports?: boolean;
  ignore_balance?: boolean;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  category_id: string;
  amount_cents: number;
  description?: string;
  category?: Category;
}

export interface AccountSnapshot {
  id: string;
  account_id: string;
  snapshot_date: string;
  balance_cents: number;
  created_at?: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
  credit_limit_cents?: number;
  current_invoice_cents?: number;
  ceiling_impact_cents?: number;
  closed_invoice_cents?: number;
  closed_invoice_month?: string;
  open_invoice_cents?: number;
  open_invoice_month?: string;
  total_debt_cents?: number;
  closing_day?: number;
  due_day?: number;
  color_hex?: string;
  user_id: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  monthly_contribution_cents: number;
  priority: number;
  status: "active" | "completed" | "paused" | "planning" | "PLANNING" | "ACTIVE" | "COMPLETED";
  deadline?: string;
  projected_completion_date?: string;
  color_hex?: string;
  user_id?: string;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  frequency: "monthly" | "weekly" | "yearly" | "biweekly" | string;
  next_date: string;
  status: "active" | "paused" | "cancelled";
  category_id?: string;
  account_id?: string;
  user_id?: string;
  is_primary_income?: boolean;
  excluded_months?: string[];
}

export interface Budget {
  id: string;
  category_id: string;
  amount_cents: number;
  spent_cents?: number;
  limit_cents?: number;
  user_id?: string;
}

export interface FinancialHealthScore {
  id: string;
  score: number;
  updated_at: string;
}

export interface UserGamificationProfile {
  id: string;
  user_id: string;
  resilience_points: number;
  current_streak: number;
  max_streak: number;
  active_theme: string;
  unlocked_achievements: any[];
  created_at: string;
  updated_at: string;
}

export interface MonthlyBalanceOverride {
  id: string;
  user_id: string;
  month_key: string;
  balance_cents: number;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: string;
  account_id: string;
  category_id?: string | null;
  user_id: string;
  is_paid: boolean;
  is_legacy_debt?: boolean;
  installment_current?: number;
  installment_total?: number;
  invoice_id?: string | null;
  category_name?: string | null;
  category_type?: string | null;
  source?: string;
  category?: Category;
  account?: Account;
  is_adjustment?: boolean;
  is_third_party?: boolean;
  third_party_name?: string | null;
  source_metadata?: {
    recurring_id?: string;
    [key: string]: any;
  };
  splits?: TransactionSplit[];
}

export class VesperDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  goals!: Table<Goal>;
  recurring_transactions!: Table<RecurringTransaction>;
  budgets!: Table<Budget>;
  financial_health_score!: Table<FinancialHealthScore>;
  transactions!: Table<Transaction>;
  gamification_profile!: Table<UserGamificationProfile>;
  monthly_balance_overrides!: Table<MonthlyBalanceOverride>;
  account_snapshots!: Table<AccountSnapshot>;

  constructor() {
    super('VesperDB');
    this.version(6).stores({
      accounts: 'id, user_id, type',
      account_snapshots: 'id, account_id, snapshot_date',
      categories: 'id, user_id, type',
      goals: 'id, user_id',
      recurring_transactions: 'id, user_id, status',
      budgets: 'id, user_id, category_id',
      financial_health_score: 'id',
      transactions: 'id, user_id, account_id, category_id, date'
    });
    this.version(6).stores({
      gamification_profile: 'id, user_id'
    });
    this.version(7).stores({
      monthly_balance_overrides: 'id, user_id, month_key, [user_id+month_key]'
    });
  }
}

export const db = new VesperDB();
