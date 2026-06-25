import { useEffect, useState, useCallback } from 'react';
import { Plus, Users, Clock, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group, Expense, Settlement, ActivityItem, Profile } from '../types';
import { useGroups } from '../hooks/useGroups';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { formatCurrency } from '../lib/currency';

interface DashboardProps {
  currentProfile: Profile | null;
}

interface GroupSummary extends Group {
  totalExpenses: number;
  userBalance: number;
  isSettled: boolean;
}

export default function Dashboard({ currentProfile }: DashboardProps) {
  const navigate = useNavigate();
  const { groups, fetchGroups, loading: loadingGroups } = useGroups();
  const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  const [stats, setStats] = useState({
    totalOwedToYou: 0,
    youOwe: 0,
    activeGroupsCount: 0,
    pendingSettlementsCount: 0,
  });

  const loadDashboardData = useCallback(async () => {
    if (!currentProfile) return;
    setLoadingDetails(true);

    try {
      const activeGroups = await fetchGroups();
      if (!activeGroups || activeGroups.length === 0) {
        setGroupSummaries([]);
        setActivities([]);
        setStats({
          totalOwedToYou: 0,
          youOwe: 0,
          activeGroupsCount: 0,
          pendingSettlementsCount: 0,
        });
        return;
      }

      const summaries: GroupSummary[] = [];
      const allActivities: ActivityItem[] = [];
      let totalOwedToYou = 0;
      let youOwe = 0;
      let pendingSettlementsCount = 0;

      // Process each group in parallel
      await Promise.all(
        activeGroups.map(async (group) => {
          // 1. Fetch expenses
          const { data: expensesData, error: expErr } = await supabase
            .from('expenses')
            .select(`
              *,
              payer:profiles!expenses_paid_by_fkey(*),
              splits:expense_splits(
                *,
                profile:profiles(*)
              )
            `)
            .eq('group_id', group.id);

          if (expErr) throw expErr;

          // 2. Fetch settlements
          const { data: settlementsData, error: setErr } = await supabase
            .from('settlements')
            .select(`
              *,
              payer:profiles!settlements_payer_id_fkey(*),
              payee:profiles!settlements_payee_id_fkey(*)
            `)
            .eq('group_id', group.id);

          if (setErr) throw setErr;

          const expenses = (expensesData || []) as Expense[];
          const settlements = (settlementsData || []) as Settlement[];
          const members: Profile[] = group.members || [];

          // Compute balances for this group
          const netBalances: { [profileId: string]: number } = {};
          members.forEach((m) => {
            netBalances[m.id] = 0;
          });

          expenses.forEach((expense) => {
            if (netBalances[expense.paid_by] !== undefined) {
              netBalances[expense.paid_by] += expense.amount;
            }
            if (expense.splits) {
              expense.splits.forEach((split) => {
                if (netBalances[split.profile_id] !== undefined) {
                  netBalances[split.profile_id] -= split.amount;
                }
              });
            }
          });

          settlements.forEach((s) => {
            if (netBalances[s.payer_id] !== undefined) {
              netBalances[s.payer_id] += s.amount;
            }
            if (netBalances[s.payee_id] !== undefined) {
              netBalances[s.payee_id] -= s.amount;
            }
          });

          const userBal = netBalances[currentProfile.id] || 0;
          const groupTotalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

          // Check if group is settled (all balances close to 0)
          const isSettled = Object.values(netBalances).every((bal) => Math.abs(bal) < 0.1);

          summaries.push({
            ...group,
            totalExpenses: groupTotalExpenses,
            userBalance: Math.round(userBal * 100) / 100,
            isSettled,
          });

          // Aggregate user stats
          if (userBal > 0.01) {
            totalOwedToYou += userBal;
          } else if (userBal < -0.01) {
            youOwe += Math.abs(userBal);
          }

          // Build group activities
          expenses.forEach((exp) => {
            const payerName = exp.payer?.id === currentProfile.id
              ? 'You'
              : exp.payer?.full_name || exp.payer?.username || 'Someone';

            const userSplit = exp.splits?.find((s) => s.profile_id === currentProfile.id);
            let userDiffText = '';

            if (userSplit) {
              if (exp.paid_by === currentProfile.id) {
                const owedAmt = exp.amount - userSplit.amount;
                userDiffText = owedAmt > 0 ? `You are owed ${formatCurrency(owedAmt, group.currency || 'USD')}` : '';
              } else {
                userDiffText = `You owe ${formatCurrency(userSplit.amount, group.currency || 'USD')}`;
              }
            }

            allActivities.push({
              id: exp.id,
              type: 'expense',
              title: exp.description,
              description: userDiffText || `${payerName} paid ${formatCurrency(exp.amount, group.currency || 'USD')}`,
              amount: exp.amount,
              created_at: exp.created_at,
              group_id: group.id,
              group_name: group.name,
              user_id: exp.paid_by,
              user_name: payerName,
              user_avatar: exp.payer?.avatar_url || undefined,
            });
          });

          settlements.forEach((s) => {
            const payerName = s.payer?.id === currentProfile.id
              ? 'You'
              : s.payer?.full_name || s.payer?.username || 'Someone';
            
            const payeeName = s.payee?.id === currentProfile.id
              ? 'you'
              : s.payee?.full_name || s.payee?.username || 'someone';

            const isRelevant = s.payer_id === currentProfile.id || s.payee_id === currentProfile.id;
            
            if (isRelevant && s.payer_id === currentProfile.id) {
              pendingSettlementsCount++;
            }

            allActivities.push({
              id: s.id,
              type: 'settlement',
              title: `${payerName} settled`,
              description: `${payerName} paid ${payeeName} ${formatCurrency(s.amount, group.currency || 'USD')}`,
              amount: s.amount,
              created_at: s.created_at,
              group_id: group.id,
              group_name: group.name,
              user_id: s.payer_id,
              user_name: payerName,
              user_avatar: s.payer?.avatar_url || undefined,
            });
          });
        })
      );

      // Sort activities by date descending
      allActivities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setGroupSummaries(summaries);
      setActivities(allActivities.slice(0, 10)); // Top 10 activities

      setStats({
        totalOwedToYou: Math.round(totalOwedToYou * 100) / 100,
        youOwe: Math.round(youOwe * 100) / 100,
        activeGroupsCount: activeGroups.length,
        pendingSettlementsCount,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [currentProfile, fetchGroups]);

  useEffect(() => {
    if (currentProfile) {
      loadDashboardData();
    }
  }, [currentProfile, loadDashboardData]);

  const loading = loadingGroups || loadingDetails;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-slate-900 dark:text-white font-display">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Welcome back, <span className="font-semibold text-slate-800 dark:text-gray-200">{currentProfile?.full_name || 'user'}</span>. Here's where you stand.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="w-11 h-11 rounded-xl glass-panel flex items-center justify-center hover:bg-slate-200/20 dark:hover:bg-white/10 transition-colors border border-brand-border/40 text-slate-600 dark:text-gray-300 cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsExpenseOpen(true)}
            className="bg-brand-primary hover:bg-indigo-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] flex items-center gap-2 cursor-pointer font-display"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        </div>
      </div>

      {loading && groupSummaries.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-primary"></div>
        </div>
      ) : (
        <>
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-1 flex items-center gap-1.5 font-display">
                <TrendingUp className="w-4 h-4" />
                Total Owed to You
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-display mt-2">{formatCurrency(stats.totalOwedToYou, currentProfile?.currency || 'USD')}</div>
            </div>

            <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-1 flex items-center gap-1.5 font-display">
                <TrendingDown className="w-4 h-4" />
                You Owe
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-display mt-2">{formatCurrency(stats.youOwe, currentProfile?.currency || 'USD')}</div>
            </div>

            <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-primary"></div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1 flex items-center gap-1.5 font-display">
                <Users className="w-4 h-4" />
                Active Groups
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-display mt-2">{stats.activeGroupsCount}</div>
            </div>

            <div className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-accent"></div>
              <div className="text-xs font-bold uppercase tracking-wider text-brand-accent mb-1 flex items-center gap-1.5 font-display">
                <Clock className="w-4 h-4" />
                Pending Payments
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-display mt-2">{stats.pendingSettlementsCount}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Groups Panel */}
            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white font-display">
                  <Users className="w-5 h-5 text-brand-primary" />
                  Your Groups
                </h2>
                <button
                  onClick={() => navigate('/groups')}
                  className="text-xs font-bold text-brand-primary hover:text-indigo-400 transition-colors cursor-pointer uppercase tracking-wider"
                >
                  View All Groups
                </button>
              </div>

              {groupSummaries.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 dark:text-gray-400">
                  <p className="mb-4 font-medium">You are not part of any groups yet.</p>
                  <button
                    onClick={() => navigate('/groups')}
                    className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-800 dark:text-white px-4 py-2 rounded-xl text-sm transition-all cursor-pointer font-semibold"
                  >
                    Create or Join Group
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupSummaries.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => navigate(`/group/${group.id}`)}
                      className="glass-panel glass-panel-hoverable p-6 rounded-2xl shadow-glass cursor-pointer group flex flex-col justify-between h-48 border border-slate-200/10 dark:border-white/5"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-bold group-hover:text-brand-primary transition-colors text-slate-900 dark:text-white font-display truncate max-w-[70%]">
                            {group.name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                              group.isSettled
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}
                          >
                            {group.isSettled ? 'Settled' : 'Unsettled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-gray-400 mb-4 line-clamp-1">
                          {group.description || 'No description'}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex -space-x-2">
                            {group.members?.slice(0, 3).map((member) => (
                              <img
                                key={member.id}
                                className="w-6 h-6 rounded-full border-2 border-brand-bg object-cover shadow-sm"
                                src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name || 'U'}&background=random`}
                                alt={member.full_name || ''}
                                title={member.full_name || ''}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                            {group.members?.length || 0} members
                          </span>
                          <span className="text-[10px] font-bold font-mono bg-slate-200/50 dark:bg-white/5 px-2 py-0.5 rounded text-slate-600 dark:text-gray-400 ml-auto">
                            {group.currency || 'USD'}
                          </span>
                        </div>

                        <div className="flex justify-between items-end border-t border-slate-200/20 dark:border-white/5 pt-3">
                          <div>
                            <div className="text-[10px] text-slate-500 dark:text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Total Expenses</div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white font-display">{formatCurrency(group.totalExpenses, group.currency || 'USD')}</div>
                          </div>
                          <div className="text-right">
                            {group.userBalance > 0.01 ? (
                              <>
                                <div className="text-[10px] text-emerald-500 mb-0.5 uppercase tracking-wider font-semibold">You are owed</div>
                                <div className="font-bold text-sm text-emerald-500 font-display">
                                  +{formatCurrency(group.userBalance, group.currency || 'USD')}
                                </div>
                              </>
                            ) : group.userBalance < -0.01 ? (
                              <>
                                <div className="text-[10px] text-rose-500 mb-0.5 uppercase tracking-wider font-semibold">You owe</div>
                                <div className="font-bold text-sm text-rose-500 font-display">
                                  -{formatCurrency(Math.abs(group.userBalance), group.currency || 'USD')}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-[10px] text-slate-500 dark:text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Balance</div>
                                <div className="font-bold text-sm text-slate-700 dark:text-gray-300 font-display">{formatCurrency(0, group.currency || 'USD')}</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity Panel */}
            <div className="lg:col-span-1">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white font-display">
                <Clock className="w-5 h-5 text-brand-accent" />
                Recent Activity
              </h2>
              <div className="glass-panel p-6 rounded-2xl shadow-glass max-h-[400px] overflow-y-auto border border-slate-200/10 dark:border-white/5">
                {activities.length === 0 ? (
                  <div className="text-center text-slate-400 dark:text-gray-400 text-sm py-10">
                    No recent activities to show.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activities.map((act, idx) => (
                      <div key={act.id} className="flex gap-4 relative">
                        {/* Timeline connecting line */}
                        {idx < activities.length - 1 && (
                          <div className="w-[2px] h-full bg-slate-200 dark:bg-white/10 absolute left-[15px] top-8 -z-10"></div>
                        )}
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-brand-border">
                          <img
                            src={
                              act.user_avatar ||
                              `https://ui-avatars.com/api/?name=${act.user_name}&background=6366F1&color=fff`
                            }
                            alt={act.user_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-white">
                            <span className="font-semibold text-slate-950 dark:text-white">{act.user_name}</span>{' '}
                            {act.type === 'expense' ? (
                              <>
                                added <span className="font-semibold text-slate-900 dark:text-gray-200">{act.title}</span>
                              </>
                            ) : (
                              <span className="text-slate-600 dark:text-gray-300">{act.description}</span>
                            )}
                          </p>
                          {act.type === 'expense' && act.description && (
                            <p
                              className={`text-xs mt-1 font-bold ${
                                act.description.includes('owed') ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {act.description}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">
                            {new Date(act.created_at).toLocaleDateString()} at{' '}
                            {new Date(act.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            in <span className="font-medium text-slate-500 dark:text-gray-400">{act.group_name}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Expense Modal */}
      {currentProfile && (
        <AddExpenseModal
          isOpen={isExpenseOpen}
          onClose={() => setIsExpenseOpen(false)}
          groups={groups}
          currentUserId={currentProfile.id}
          onExpenseCreated={loadDashboardData}
        />
      )}
    </>
  );
}
