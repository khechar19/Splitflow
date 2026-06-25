import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Settlement } from '../types';

export function useSettlements() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async (groupId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('settlements')
        .select(`
          *,
          payer:profiles!settlements_payer_id_fkey(*),
          payee:profiles!settlements_payee_id_fkey(*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (err) throw err;

      const formattedSettlements = (data || []).map((s: any) => ({
        ...s,
        payer: s.payer,
        payee: s.payee,
      })) as Settlement[];

      setSettlements(formattedSettlements);
      return formattedSettlements;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createSettlement = async (
    groupId: string,
    payerId: string,
    payeeId: string,
    amount: number
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('settlements')
        .insert({
          group_id: groupId,
          payer_id: payerId,
          payee_id: payeeId,
          amount,
        })
        .select()
        .single();

      if (err) throw err;
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteSettlement = async (settlementId: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error: err } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlementId);

      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    settlements,
    loading,
    error,
    fetchSettlements,
    createSettlement,
    deleteSettlement,
  };
}
