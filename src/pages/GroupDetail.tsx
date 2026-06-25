import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group, Profile, Expense, Settlement, Debt } from '../types';
import { useGroups } from '../hooks/useGroups';
import { useExpenses } from '../hooks/useExpenses';
import { useSettlements } from '../hooks/useSettlements';
import { useBalances } from '../hooks/useBalances';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { SettleModal } from '../components/SettleModal';
import { formatCurrency } from '../lib/currency';
import {
  ArrowLeft,
  Plus,
  UserPlus,
  Trash2,
  FileText,
  DollarSign,
  Users,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface GroupDetailProps {
  currentProfile: Profile | null;
}

export default function GroupDetail({ currentProfile }: GroupDetailProps) {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { addMemberByUsername, removeMember, loading: loadingGroupAction } = useGroups();
  const { fetchExpenses, deleteExpense } = useExpenses();
  const { fetchSettlements, deleteSettlement } = useSettlements();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [preselectedDebt, setPreselectedDebt] = useState<Debt | null>(null);

  // Add Member Input
  const [usernameInput, setUsernameInput] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch group details
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupErr) throw groupErr;

      // 2. Fetch group members
      const { data: membersData, error: memErr } = await supabase
        .from('group_members')
        .select('profiles(*)')
        .eq('group_id', groupId);

      if (memErr) throw memErr;

      const profileList = (membersData?.map((m: any) => m.profiles).filter(Boolean) || []) as Profile[];

      setGroup(groupData);
      setMembers(profileList);

      // 3. Fetch expenses and settlements
      const expList = await fetchExpenses(groupId);
      const setList = await fetchSettlements(groupId);

      setExpenses(expList);
      setSettlements(setList);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Group details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [groupId, fetchExpenses, fetchSettlements]);

  useEffect(() => {
    if (currentProfile && groupId) {
      loadGroupDetails();
    }
  }, [currentProfile, groupId, loadGroupDetails]);

  // Balance & Debt Calculations
  const { netBalances, debts } = useBalances(members, expenses, settlements);

  // Add Member Handler
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    setMemberSuccess('');

    if (!usernameInput.trim()) return;
    if (!groupId) return;

    try {
      const addedProfile = await addMemberByUsername(groupId, usernameInput);
      setMemberSuccess(`Successfully added ${addedProfile.full_name || addedProfile.username}!`);
      setUsernameInput('');
      loadGroupDetails(); // Reload
    } catch (err: any) {
      setMemberError(err.message || 'Could not add user.');
    }
  };

  // Remove Member Handler
  const handleRemoveMember = async (profileId: string) => {
    if (!groupId) return;
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;

    try {
      await removeMember(groupId, profileId);
      loadGroupDetails();
    } catch (err: any) {
      alert(err.message || 'Could not remove member.');
    }
  };

  // Delete Expense Handler
  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense? This will recalculate all balances.')) return;

    try {
      await deleteExpense(expenseId);
      loadGroupDetails();
    } catch (err: any) {
      alert(err.message || 'Could not delete expense.');
    }
  };

  // Delete Settlement Handler
  const handleDeleteSettlement = async (settlementId: string) => {
    if (!window.confirm('Are you sure you want to delete this settlement?')) return;

    try {
      await deleteSettlement(settlementId);
      loadGroupDetails();
    } catch (err: any) {
      alert(err.message || 'Could not delete settlement.');
    }
  };

  const handleSettleDebt = (debt: Debt) => {
    setPreselectedDebt(debt);
    setIsSettleOpen(true);
  };

  const isGroupCreator = group?.created_by === currentProfile?.id;

  if (loading && !group) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-primary"></div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-xl mx-auto text-center mt-10">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          {error || 'Group not found.'}
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-brand-primary hover:underline flex items-center justify-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 font-display">{group.name}</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm max-w-xl">{group.description || 'No description provided.'}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setPreselectedDebt(null);
              setIsSettleOpen(true);
            }}
            className="glass-panel text-slate-800 dark:text-white hover:bg-slate-200/20 dark:hover:bg-white/10 px-5 py-2.5 rounded-xl font-medium transition-all border border-brand-border/40 flex items-center gap-2 cursor-pointer font-display shadow-glass hover:shadow-float"
          >
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Record Payment
          </button>

          <button
            onClick={() => setIsExpenseOpen(true)}
            className="bg-brand-primary hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] flex items-center gap-2 cursor-pointer font-display"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Expenses Feed & Settlements */}
        <div className="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Debts/Settling list */}
          <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2 font-display">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
              Balances & Debts
            </h2>
            {debts.length === 0 ? (
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium">Everyone is settled up! No active debts.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5 space-y-3.5 pt-1">
                {debts.map((debt, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-border shrink-0">
                        <img
                          src={debt.fromProfile?.avatar_url || `https://ui-avatars.com/api/?name=${debt.fromProfile?.full_name || 'U'}&background=random`}
                          alt="Debtor"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-sm text-slate-600 dark:text-gray-400">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {debt.fromProfile?.id === currentProfile?.id ? 'You' : debt.fromProfile?.full_name || debt.fromProfile?.username}
                        </span>{' '}
                        {debt.fromProfile?.id === currentProfile?.id ? 'owe' : 'owes'}{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {debt.toProfile?.id === currentProfile?.id ? 'you' : debt.toProfile?.full_name || debt.toProfile?.username}
                        </span>
                        <div className="text-xs text-slate-500 dark:text-gray-500 font-medium font-mono mt-0.5">
                          {debt.fromProfile?.username} → {debt.toProfile?.username}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-bold text-sm text-slate-900 dark:text-white font-display">{formatCurrency(debt.amount, group?.currency || 'USD')}</span>
                      </div>
                      <button
                        onClick={() => handleSettleDebt(debt)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg text-xs font-semibold transition-all font-display hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] cursor-pointer"
                      >
                        Settle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expenses Log */}
          <div>
            <h2 className="text-xl font-extrabold mb-4 text-slate-900 dark:text-white font-display">Group Expenses</h2>
            {expenses.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl text-center text-slate-500 dark:text-gray-400 text-sm shadow-glass">
                No expenses logged yet. Add one using the button above.
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense) => {
                  const isExpensePayer = expense.paid_by === currentProfile?.id;
                  const payerName = isExpensePayer
                    ? 'You'
                    : expense.payer?.full_name || expense.payer?.username || 'Member';

                  return (
                    <div
                      key={expense.id}
                      className="glass-panel glass-panel-hoverable p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 border border-brand-border/40 shadow-glass"
                    >
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 border border-brand-primary/20">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white text-base truncate font-display">{expense.description}</h4>
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                            Paid by <span className="font-semibold text-slate-700 dark:text-gray-300">{payerName}</span> on{' '}
                            {new Date(expense.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-200/40 dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-300/40 dark:border-white/5">
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

                      <div className="flex justify-between md:justify-end items-center gap-6 border-t md:border-t-0 border-slate-100 dark:border-white/5 pt-3 md:pt-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Amount</div>
                          <div className="font-bold text-lg text-slate-900 dark:text-white font-display">{formatCurrency(expense.amount, group?.currency || 'USD')}</div>
                        </div>

                        {(isExpensePayer || isGroupCreator) && (
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-slate-400 hover:text-rose-500 p-2 rounded-lg hover:bg-slate-200/40 dark:hover:bg-white/5 transition-all cursor-pointer"
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
          </div>

          {/* Settlements Log */}
          {settlements.length > 0 && (
            <div>
              <h2 className="text-xl font-extrabold mb-4 text-slate-900 dark:text-white font-display">Settlement Payments</h2>
              <div className="space-y-3">
                {settlements.map((s) => {
                  const isPayer = s.payer_id === currentProfile?.id;
                  const isPayee = s.payee_id === currentProfile?.id;
                  const payerName = isPayer ? 'You' : s.payer?.full_name || s.payer?.username;
                  const payeeName = isPayee ? 'you' : s.payee?.full_name || s.payee?.username;

                  return (
                    <div
                      key={s.id}
                      className="glass-panel glass-panel-hoverable p-4 rounded-xl flex justify-between items-center border border-brand-border/40 hover:border-emerald-500/20 shadow-glass"
                    >
                      <div className="text-sm text-slate-600 dark:text-gray-300">
                        <span className="font-semibold text-slate-900 dark:text-white">{payerName}</span> paid{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">{payeeName}</span>{' '}
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-display">{formatCurrency(s.amount, group?.currency || 'USD')}</span>
                        <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                          {new Date(s.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {(isPayer || isPayee || isGroupCreator) && (
                        <button
                          onClick={() => handleDeleteSettlement(s.id)}
                          className="text-slate-400 hover:text-rose-500 p-2 rounded-lg hover:bg-slate-200/40 dark:hover:bg-white/5 transition-all cursor-pointer"
                          title="Delete settlement record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Group Members & Add Member Panel */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Members List */}
          <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2 font-display">
              <Users className="w-5 h-5 text-brand-primary" />
              Members ({members.length})
            </h2>

            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-56 overflow-y-auto pr-1">
              {members.map((member) => (
                <div key={member.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name || 'U'}&background=random`}
                      alt={member.full_name || ''}
                      className="w-8 h-8 rounded-full border border-brand-border object-cover shrink-0"
                    />
                    <div className="text-sm min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                        {member.full_name || 'Group Member'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-[120px] font-mono">{member.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* User balance in this group */}
                    {(() => {
                      const bal = netBalances[member.id] || 0;
                      if (bal > 0.01) {
                        return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(bal, group?.currency || 'USD')}</span>;
                      } else if (bal < -0.01) {
                        return <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(Math.abs(bal), group?.currency || 'USD')}</span>;
                      } else {
                        return <span className="text-xs text-slate-500 dark:text-gray-500 font-medium">{formatCurrency(0, group?.currency || 'USD')}</span>;
                      }
                    })()}

                    {/* Creator can remove members; members can remove themselves */}
                    {((isGroupCreator && member.id !== group.created_by) ||
                      (member.id === currentProfile?.id && members.length > 1)) && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                        title={member.id === currentProfile?.id ? 'Leave group' : 'Remove member'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Member panel */}
          <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2 font-display">
              <UserPlus className="w-5 h-5 text-brand-accent" />
              Add Member
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
              Add users using their unique handles (e.g. `@AB1234`).
            </p>

            {memberError && (
              <div className="mb-3.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-1.5 animate-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{memberError}</span>
              </div>
            )}

            {memberSuccess && (
              <div className="mb-3.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-1.5 animate-in slide-in-from-top-1">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                <span>{memberSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. @AB1234"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="flex-1 glass-input px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:ring-1 focus:ring-brand-primary"
              />
              <button
                type="submit"
                disabled={loadingGroupAction}
                className="bg-brand-primary hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_0_10px_rgba(99,102,241,0.2)] font-display hover:shadow-[0_0_18px_rgba(99,102,241,0.4)] cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Expense Creator Modal */}
      {currentProfile && (
        <AddExpenseModal
          isOpen={isExpenseOpen}
          onClose={() => setIsExpenseOpen(false)}
          groupId={groupId}
          groups={group ? [group] : []}
          currentUserId={currentProfile.id}
          onExpenseCreated={loadGroupDetails}
        />
      )}

      {/* Settle Modal */}
      {currentProfile && groupId && (
        <SettleModal
          isOpen={isSettleOpen}
          onClose={() => {
            setIsSettleOpen(false);
            setPreselectedDebt(null);
          }}
          groupId={groupId}
          members={members}
          currentUserId={currentProfile.id}
          preselectedDebt={preselectedDebt}
          groupCurrency={group?.currency || 'USD'}
          onSettlementCreated={loadGroupDetails}
        />
      )}
    </>
  );
}
