import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCategories() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createCategory(category: Omit<Category, 'id'>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('categories')
        .insert({ ...category, user_id: user.id });

      if (error) throw error;
      await fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    try {
      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async function deleteCategory(id: string) {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  return { 
    categories, 
    loading, 
    refresh: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
}
