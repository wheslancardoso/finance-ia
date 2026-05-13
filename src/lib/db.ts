import Dexie, { type Table } from 'dexie';

export interface Category {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  user_id?: string;
  color_hex?: string;
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
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
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
  frequency: "monthly" | "weekly" | "yearly";
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
  source?: string;
  category?: Category;
  account?: Account;
  is_adjustment?: boolean;
  source_metadata?: {
    recurring_id?: string;
    [key: string]: any;
  };
}

export class VesperDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  goals!: Table<Goal>;
  recurring_transactions!: Table<RecurringTransaction>;
  budgets!: Table<Budget>;
  financial_health_score!: Table<FinancialHealthScore>;
  transactions!: Table<Transaction>;

  constructor() {
    super('VesperDB');
    this.version(5).stores({
      accounts: 'id, user_id, type',
      categories: 'id, user_id, type',
      goals: 'id, user_id',
      recurring_transactions: 'id, user_id, status',
      budgets: 'id, user_id, category_id',
      financial_health_score: 'id',
      transactions: 'id, user_id, account_id, category_id, date'
    });
  }
}

export const db = new VesperDB();
