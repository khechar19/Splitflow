import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Expense, Group, Profile } from '../types';
import { DollarSign, FileText, Trash2, AlertCircle, Filter } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { formatCurrency } from '../lib/currency';

interface ExpensesProps {
  currentProfile: Profile | null;
}

export default function Expenses({ currentProfile }: ExpensesProps) {
  const { deleteExpense } = useExpenses();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExpensesData = useCallback(async () => {
    if (!currentProfile) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch all expenses with payer, group and split profiles
      const { data, error: expErr } = await supabase
        .from('expenses')
        .select(`
          *,
          payer:profiles!expenses_paid_by_fkey(*),
          group:groups(*),
          splits:expense_splits(
            *,
            profile:profiles(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (expErr) throw expErr;

      const formatted = (data || []).map((exp: any) => ({
        ...exp,
        payer: exp.payer,
        group: exp.group,
        splits: exp.splits.map((s: any) => ({
          ...s,
          profile: s.profile,
        })),
      })) as any[];

      setExpenses(formatted);

      // 2. Extract unique groups from expenses for filtering
      const uniqueGroups: Group[] = [];
      formatted.forEach((exp) => {
        if (exp.group && !uniqueGroups.some((g) => g.id === exp.group.id)) {
          uniqueGroups.push(exp.group);
        }
      });
      setGroups(uniqueGroups);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not fetch expenses.');
    } finally {
      setLoading(false);
    }
  }, [currentProfile]);

  useEffect(() => {
    if (currentProfile) {
      loadExpensesData();
    }
  }, [currentProfile, loadExpensesData]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense? This will recalculate balances.')) return;

    try {
      await deleteExpense(expenseId);
      loadExpensesData(); // Reload
    } catch (err: any) {
      alert(err.message || 'Could not delete expense.');
    }
  };

  const filteredExpenses = selectedGroupId === 'all'
    ? expenses
    : expenses.filter((e) => e.group_id === selectedGroupId);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Expenses</h1>
          <p className="text-gray-400">Consolidated history of all your shared expenses.</p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-medium text-gray-400">Group:</span>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="glass-input px-3.5 py-2 rounded-xl text-xs text-white appearance-none cursor-pointer border border-brand-border focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all" className="bg-brand-bg text-white">All Groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id} className="bg-brand-bg text-white">
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && expenses.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>Error: {error}</span>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-gray-400 text-sm">
          No expenses found.
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          {filteredExpenses.map((expense) => {
            const isPayer = expense.paid_by === currentProfile?.id;
            const payerName = isPayer
              ? 'You'
              : expense.payer?.full_name || expense.payer?.username || 'Member';

            // Find my split share
            const mySplit = expense.splits?.find((s) => s.profile_id === currentProfile?.id);

            return (
              <div
                key={expense.id}
                className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-brand-primary/20 transition-all border border-white/5"
              >
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 border border-brand-primary/20">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-base truncate">{expense.description}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Paid by <span className="font-semibold text-gray-300">{payerName}</span> in{' '}
                      <span className="font-semibold text-brand-primary">{(expense as any).group?.name}</span> on{' '}
                      {new Date(expense.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/5">
                        {expense.split_type}
                      </span>
                      {expense.receipt_url && (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-semibold text-brand-primary hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Receipt
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between md:justify-end items-center gap-6 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-400 mb-0.5">Total Amount</div>
                    <div className="font-bold text-base text-white">{formatCurrency(expense.amount, (expense as any).group?.currency || 'USD')}</div>
                  </div>

                  <div className="text-right">
                    {isPayer ? (
                      mySplit ? (
                        <>
                          <div className="text-xs text-emerald-400 mb-0.5">You lent</div>
                          <div className="font-bold text-base text-emerald-400">
                            +{formatCurrency(expense.amount - mySplit.amount, (expense as any).group?.currency || 'USD')}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs text-emerald-400 mb-0.5">You lent</div>
                          <div className="font-bold text-base text-emerald-400">+{formatCurrency(expense.amount, (expense as any).group?.currency || 'USD')}</div>
                        </>
                      )
                    ) : mySplit ? (
                      <>
                        <div className="text-xs text-rose-400 mb-0.5">You owe</div>
                        <div className="font-bold text-base text-rose-400">-{formatCurrency(mySplit.amount, (expense as any).group?.currency || 'USD')}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-gray-500 mb-0.5">No share</div>
                        <div className="font-bold text-base text-gray-400">{formatCurrency(0, (expense as any).group?.currency || 'USD')}</div>
                      </>
                    )}
                  </div>

                  {(isPayer || (expense as any).group?.created_by === currentProfile?.id) && (
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="text-gray-500 hover:text-rose-400 p-2 rounded-lg hover:bg-white/5 transition-all"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
