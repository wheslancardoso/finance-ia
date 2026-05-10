import Dexie, { type Table } from 'dexie';

export interface Category {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  family_group_id?: string;
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
  closing_day?: number;
  due_day?: number;
  color_hex?: string;
  family_group_id: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  monthly_contribution_cents: number;
  deadline?: string;
  projected_completion_date?: string;
  color_hex?: string;
  family_group_id?: string;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  frequency: "monthly" | "weekly" | "yearly";
  next_date: string;
  status: "active" | "inactive";
  category_id?: string;
  account_id?: string;
  family_group_id?: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount_cents: number;
  family_group_id?: string;
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
  family_group_id: string;
  is_paid: boolean;
  is_legacy_debt?: boolean;
  installment_current?: number;
  installment_total?: number;
  source?: string;
  category?: Category;
  account?: Account;
}

export class VesperDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  goals!: Table<Goal>;
  recurring_transactions!: Table<RecurringTransaction>;
  budgets!: Table<Budget>;
  financial_health_score!: Table<FinancialHealthScore>;

  constructor() {
    super('VesperDB');
    this.version(3).stores({
      accounts: 'id, family_group_id, type',
      categories: 'id, family_group_id, type',
      goals: 'id, family_group_id',
      recurring_transactions: 'id, family_group_id, status',
      budgets: 'id, family_group_id, category_id',
      financial_health_score: 'id'
    });
  }
}

export const db = new VesperDB();
