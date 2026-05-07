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
  closing_day?: number;
  due_day?: number;
  family_group_id: string;
}

export class VesperDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;

  constructor() {
    super('VesperDB');
    this.version(1).stores({
      accounts: 'id, family_group_id, type',
      categories: 'id, family_group_id, type'
    });
  }
}

export const db = new VesperDB();
