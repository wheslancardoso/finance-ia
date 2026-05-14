import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Goal {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  deadline?: string;
  color_hex?: string;
  priority?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  monthly_contribution_cents: number;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchGoals() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function contribute(goalId: string, amountCents: number) {
    try {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      const newAmount = (goal.current_amount_cents || 0) + amountCents;
      
      const { error } = await supabase
        .from('goals')
        .update({ current_amount_cents: newAmount })
        .eq('id', goalId);

      if (error) throw error;
      
      setGoals(prev => prev.map(g => 
        g.id === goalId ? { ...g, current_amount_cents: newAmount } : g
      ));
    } catch (error) {
      console.error('Error contributing to goal:', error);
    }
  }

  async function createGoal(goal: Omit<Goal, 'id' | 'status'>) {
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert([{ ...goal, status: 'ACTIVE', current_amount_cents: 0 }])
        .select()
        .single();

      if (error) throw error;
      setGoals(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }

  useEffect(() => {
    fetchGoals();
  }, []);

  return { goals, loading, refresh: fetchGoals, contribute, createGoal };
}
