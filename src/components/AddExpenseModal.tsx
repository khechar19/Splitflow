import { useState, useEffect, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group, Profile, SplitType } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { getCurrencySymbol, formatCurrency } from '../lib/currency';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId?: string | null;
  groups: Group[];
  currentUserId: string;
  onExpenseCreated: () => void;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  groupId,
  groups,
  currentUserId,
  onExpenseCreated,
}: AddExpenseModalProps) {
  const navigate = useNavigate();
  const { createExpense, loading, error: apiError } = useExpenses();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Split-specific states
  // For 'equal': record which member IDs are checked (default all)
  const [selectedMembers, setSelectedMembers] = useState<{ [id: string]: boolean }>({});
  // For 'exact': record amount string for each member ID
  const [exactAmounts, setExactAmounts] = useState<{ [id: string]: string }>({});
  // For 'percentage': record percent string for each member ID
  const [percentages, setPercentages] = useState<{ [id: string]: string }>({});
  
  const [validationError, setValidationError] = useState('');

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const groupCurrency = selectedGroup?.currency || 'USD';
  const groupSymbol = getCurrencySymbol(groupCurrency);

  // Set default group when modal opens or groupId changes
  useEffect(() => {
    if (isOpen) {
      if (groupId) {
        setSelectedGroupId(groupId);
      } else if (groups.length > 0) {
        setSelectedGroupId(groups[0].id);
      }
    }
  }, [isOpen, groupId, groups]);

  // Fetch group members when selected group changes
  const fetchMembers = useCallback(async (gId: string) => {
    try {
      setLoadingMembers(true);
      const { data, error } = await supabase
        .from('group_members')
        .select('profiles(*)')
        .eq('group_id', gId);

      if (error) throw error;
      const profiles = (data?.map((d: any) => d.profiles).filter(Boolean) || []) as Profile[];
      setGroupMembers(profiles);

      // Reset split helper states
      const initialChecked: { [id: string]: boolean } = {};
      const initialExacts: { [id: string]: string } = {};
      const initialPercents: { [id: string]: string } = {};

      // Equal split default: split with everyone (divided equally)
      profiles.forEach((member) => {
        initialChecked[member.id] = true;
        initialExacts[member.id] = '';
        initialPercents[member.id] = '';
      });

      setSelectedMembers(initialChecked);
      setExactAmounts(initialExacts);
      setPercentages(initialPercents);
    } catch (err) {
      console.error('Error fetching group members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchMembers(selectedGroupId);
    }
  }, [selectedGroupId, fetchMembers]);

  // Handle receipt selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
      if (!validTypes.includes(file.type)) {
        setValidationError('Invalid file type. Only PDF, PNG, JPG, JPEG allowed.');
        return;
      }
      setReceiptFile(file);
      setValidationError('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const totalAmount = parseFloat(amount);
    if (!description.trim()) {
      setValidationError('Please enter an expense name.');
      return;
    }
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setValidationError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!selectedGroupId) {
      setValidationError('Please select a group.');
      return;
    }

    const splitsPayload: { profile_id: string; share: number; amount: number }[] = [];

    if (splitType === 'equal') {
      const activeMemberIds = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);
      if (activeMemberIds.length === 0) {
        setValidationError('Select at least one member to split with.');
        return;
      }
      const splitAmt = Math.round((totalAmount / activeMemberIds.length) * 100) / 100;
      let remaining = totalAmount;

      activeMemberIds.forEach((id, index) => {
        const isLast = index === activeMemberIds.length - 1;
        // Distribute remainder to the last person to avoid rounding errors
        const currentAmt = isLast ? Math.round(remaining * 100) / 100 : splitAmt;
        remaining -= currentAmt;

        splitsPayload.push({
          profile_id: id,
          share: 1, // each has 1 share
          amount: currentAmt,
        });
      });
    } else if (splitType === 'exact') {
      let sum = 0;
      for (const member of groupMembers) {
        const val = parseFloat(exactAmounts[member.id] || '0');
        if (isNaN(val) || val < 0) {
          setValidationError(`Please enter a valid amount for ${member.full_name || 'Member'}.`);
          return;
        }
        sum += val;
        splitsPayload.push({
          profile_id: member.id,
          share: val,
          amount: Math.round(val * 100) / 100,
        });
      }

      if (Math.abs(sum - totalAmount) > 0.01) {
        setValidationError(
          `The sum of individual amounts (${formatCurrency(sum, groupCurrency)}) must equal the total expense amount (${formatCurrency(totalAmount, groupCurrency)}). Difference: ${formatCurrency(totalAmount - sum, groupCurrency)}`
        );
        return;
      }
    } else if (splitType === 'percentage') {
      let totalPercent = 0;
      for (const member of groupMembers) {
        const pct = parseFloat(percentages[member.id] || '0');
        if (isNaN(pct) || pct < 0) {
          setValidationError(`Please enter a valid percentage for ${member.full_name || 'Member'}.`);
          return;
        }
        totalPercent += pct;
      }

      if (Math.abs(totalPercent - 100) > 0.1) {
        setValidationError(`Percentages must sum to exactly 100%. Current sum: ${totalPercent.toFixed(1)}%`);
        return;
      }

      let remaining = totalAmount;
      groupMembers.forEach((member, index) => {
        const pct = parseFloat(percentages[member.id] || '0');
        const isLast = index === groupMembers.length - 1;
        const calcAmt = isLast ? Math.round(remaining * 100) / 100 : Math.round(((pct / 100) * totalAmount) * 100) / 100;
        remaining -= calcAmt;

        splitsPayload.push({
          profile_id: member.id,
          share: pct,
          amount: calcAmt,
        });
      });
    }

    try {
      await createExpense(
        selectedGroupId,
        currentUserId,
        totalAmount,
        description,
        splitType,
        splitsPayload,
        receiptFile
      );

      // Reset form on success
      setDescription('');
      setAmount('');
      setReceiptFile(null);
      onExpenseCreated();
      onClose();
    } catch (err: any) {
      console.error('Failed to create expense:', err);
    }
  };

  if (!isOpen) return null;

  if (isOpen && groups.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="glass-panel w-full max-w-md rounded-3xl shadow-float p-8 text-center relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Add Expense</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-brand-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Groups Available</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
            You need to be a member of at least one group to create an expense. Go ahead and create a group first!
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-300 hover:bg-white/5 border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/groups');
              }}
              className="flex-1 bg-brand-primary hover:bg-indigo-400 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            >
              Create Group
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-lg rounded-3xl shadow-float p-8 relative overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">New Expense</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {(validationError || apiError) && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{validationError || apiError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Expense Name</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner at Mario's"
              className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Amount ({groupSymbol})</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400">{groupSymbol}</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full glass-input pl-8 pr-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full glass-input px-4 py-3 rounded-xl text-white appearance-none transition-all cursor-pointer focus:ring-1 focus:ring-brand-primary"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id} className="bg-brand-bg text-white">
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Split Type</label>
            <div className="flex p-1 glass-input rounded-xl">
              <button
                type="button"
                onClick={() => setSplitType('equal')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  splitType === 'equal' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Equally
              </button>
              <button
                type="button"
                onClick={() => setSplitType('exact')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  splitType === 'exact' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Exact
              </button>
              <button
                type="button"
                onClick={() => setSplitType('percentage')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  splitType === 'percentage' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Percent
              </button>
            </div>
          </div>

          {/* Members Split Configurations */}
          <div className="glass-panel p-4 rounded-2xl max-h-52 overflow-y-auto space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Split Breakdown ({groupMembers.length} members)
            </h4>

            {loadingMembers && <div className="text-sm text-gray-400">Loading members...</div>}

            {!loadingMembers &&
              groupMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-4 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {splitType === 'equal' && (
                      <input
                        type="checkbox"
                        checked={!!selectedMembers[member.id]}
                        onChange={(e) =>
                          setSelectedMembers({ ...selectedMembers, [member.id]: e.target.checked })
                        }
                        className="rounded border-white/20 bg-black/40 text-brand-primary focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
                      />
                    )}
                    <span className="text-sm font-medium truncate text-white">
                      {member.full_name || 'Group Member'}{' '}
                      {member.id === currentUserId && <span className="text-xs text-brand-primary">(You)</span>}
                    </span>
                  </div>

                  {splitType === 'exact' && (
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-3 top-1.5 text-xs text-gray-400">{groupSymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={exactAmounts[member.id] || ''}
                        onChange={(e) =>
                          setExactAmounts({ ...exactAmounts, [member.id]: e.target.value })
                        }
                        className="w-full glass-input pl-6 pr-2 py-1 rounded-lg text-xs text-right text-white focus:ring-brand-primary"
                      />
                    </div>
                  )}

                  {splitType === 'percentage' && (
                    <div className="relative w-20 shrink-0">
                      <span className="absolute right-3 top-1.5 text-xs text-gray-400">%</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={percentages[member.id] || ''}
                        onChange={(e) =>
                          setPercentages({ ...percentages, [member.id]: e.target.value })
                        }
                        className="w-full glass-input pl-2 pr-6 py-1 rounded-lg text-xs text-right text-white focus:ring-brand-primary"
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Receipt Upload</label>
            <label className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-brand-primary/50 transition-colors cursor-pointer group flex flex-col items-center justify-center gap-2">
              <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
              {receiptFile ? (
                <>
                  <FileText className="w-8 h-8 text-brand-primary" />
                  <span className="text-sm font-medium text-white max-w-xs truncate">{receiptFile.name}</span>
                  <span className="text-xs text-gray-400">Click to change file</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-500 group-hover:text-brand-primary transition-colors" />
                  <span className="text-sm text-gray-400 font-medium">Click to upload receipt (PDF, PNG, JPG)</span>
                </>
              )}
            </label>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-300 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingMembers}
              className="flex-1 bg-brand-primary hover:bg-indigo-400 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
