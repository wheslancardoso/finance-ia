import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export interface RecurringTransaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  frequency: 'monthly' | 'weekly' | 'yearly';
  next_date: string;
  status: 'active' | 'paused' | 'cancelled';
  category_id?: string;
  account_id?: string;
}

export function useRecurring() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRecurring() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*, categories(name), accounts(name)')
        .order('description');

      if (error) throw error;
      setRecurring(data || []);
    } catch (error) {
      console.error('Error fetching recurring:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      setRecurring(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error toggling recurring status:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function createRecurring(data: Omit<RecurringTransaction, 'id' | 'status'>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('recurring_transactions')
        .insert({ ...data, user_id: user.id, status: 'active' });

      if (error) throw error;
      await fetchRecurring();
    } catch (error) {
      console.error('Error creating recurring:', error);
      throw error;
    }
  }

  async function updateRecurring(id: string, updates: Partial<RecurringTransaction>) {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchRecurring();
    } catch (error) {
      console.error('Error updating recurring:', error);
      throw error;
    }
  }

  async function deleteRecurring(id: string) {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchRecurring();
    } catch (error) {
      console.error('Error deleting recurring:', error);
      throw error;
    }
  }

  return { 
    recurring, 
    loading, 
    toggleStatus, 
    refresh: fetchRecurring,
    createRecurring,
    updateRecurring,
    deleteRecurring
  };
}
