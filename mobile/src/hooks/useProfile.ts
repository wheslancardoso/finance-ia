import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export interface Profile {
  id: string;
  monthly_income_cents: number;
  fixed_expenses_cents: number;
  full_name?: string;
  avatar_url?: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      if (data) {
        setProfile(data);
      } else {
        // Inicializar perfil se não existir
        setProfile({
          id: user.id,
          monthly_income_cents: 0,
          fixed_expenses_cents: 0
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(updates: Partial<Profile>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating profile:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  return { profile, loading, updateProfile, refresh: fetchProfile };
}
