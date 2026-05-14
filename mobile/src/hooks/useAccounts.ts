import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Account {
  id: string;
  name: string;
  balance_cents: number;
  type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CREDIT_CARD' | 'CASH';
  color?: string;
  institution?: string;
  last_four?: string;
  limit_cents?: number | null;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('balance_cents', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createAccount(account: Omit<Account, 'id'>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('accounts')
        .insert({ ...account, user_id: user.id });

      if (error) throw error;
      await fetchAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  async function updateAccount(id: string, updates: Partial<Account>) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  async function deleteAccount(id: string) {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  return { 
    accounts, 
    loading, 
    refresh: fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount
  };
}
