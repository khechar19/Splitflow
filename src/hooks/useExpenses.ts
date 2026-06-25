import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Expense, SplitType } from '../types';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (groupId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('expenses')
        .select(`
          *,
          payer:profiles!expenses_paid_by_fkey(*),
          splits:expense_splits(
            *,
            profile:profiles(*)
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Type-cast the raw join result to Expense[]
      const formattedExpenses = (data || []).map((exp: any) => ({
        ...exp,
        payer: exp.payer,
        splits: exp.splits.map((s: any) => ({
          ...s,
          profile: s.profile,
        })),
      })) as Expense[];

      setExpenses(formattedExpenses);
      return formattedExpenses;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = async (
    groupId: string,
    paidBy: string,
    amount: number,
    description: string,
    splitType: SplitType,
    splits: { profile_id: string; share: number; amount: number }[],
    receiptFile: File | null
  ) => {
    try {
      setLoading(true);
      setError(null);

      let receiptUrl: string | null = null;

      // 1. Upload receipt if exists
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const filePath = `${groupId}/${Date.now()}_receipt.${fileExt}`;
        
        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        receiptUrl = publicUrlData.publicUrl;
      }

      // 2. Insert expense record
      const { data: expenseData, error: expenseErr } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: paidBy,
          amount,
          description,
          split_type: splitType,
          receipt_url: receiptUrl,
        })
        .select()
        .single();

      if (expenseErr) throw expenseErr;

      // 3. Insert expense splits
      const splitRows = splits.map((s) => ({
        expense_id: expenseData.id,
        profile_id: s.profile_id,
        amount: s.amount,
        share: s.share,
      }));

      const { error: splitsErr } = await supabase
        .from('expense_splits')
        .insert(splitRows);

      if (splitsErr) throw splitsErr;

      return expenseData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error: delErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (delErr) throw delErr;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    deleteExpense,
  };
}
