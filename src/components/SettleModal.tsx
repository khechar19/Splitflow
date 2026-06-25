import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { Profile, Debt } from '../types';
import { useSettlements } from '../hooks/useSettlements';
import { getCurrencySymbol } from '../lib/currency';

interface SettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: Profile[];
  currentUserId: string;
  preselectedDebt?: Debt | null;
  groupCurrency?: string;
  onSettlementCreated: () => void;
}

export function SettleModal({
  isOpen,
  onClose,
  groupId,
  members,
  currentUserId,
  preselectedDebt,
  groupCurrency = 'USD',
  onSettlementCreated,
}: SettleModalProps) {
  const { createSettlement, loading, error: apiError } = useSettlements();

  const [payerId, setPayerId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState('');

  // Populate preselected debt or defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setValidationError('');
      if (preselectedDebt) {
        setPayerId(preselectedDebt.from);
        setPayeeId(preselectedDebt.to);
        setAmount(preselectedDebt.amount.toString());
      } else {
        setPayerId(currentUserId);
        // Default payee: first member that is not the payer
        const firstOther = members.find((m) => m.id !== currentUserId);
        setPayeeId(firstOther ? firstOther.id : '');
        setAmount('');
      }
    }
  }, [isOpen, preselectedDebt, currentUserId, members]);

  // Adjust payee if payer changes to make sure they are not the same user
  const handlePayerChange = (newPayerId: string) => {
    setPayerId(newPayerId);
    if (newPayerId === payeeId) {
      const firstOther = members.find((m) => m.id !== newPayerId);
      setPayeeId(firstOther ? firstOther.id : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const settleAmount = parseFloat(amount);
    if (!payerId || !payeeId) {
      setValidationError('Please select both a payer and a payee.');
      return;
    }
    if (payerId === payeeId) {
      setValidationError('Payer and Payee cannot be the same person.');
      return;
    }
    if (isNaN(settleAmount) || settleAmount <= 0) {
      setValidationError('Please enter a valid amount greater than 0.');
      return;
    }

    try {
      await createSettlement(groupId, payerId, payeeId, settleAmount);
      onSettlementCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create settlement:', err);
    }
  };

  if (!isOpen) return null;

  if (isOpen && members.length <= 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="glass-panel w-full max-w-md rounded-3xl shadow-float p-8 text-center relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Record Settlement</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-brand-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Insufficient Members</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
            You need at least two members in this group to record a settlement. Please add another user using their handle ID.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-brand-primary hover:bg-indigo-400 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            >
              Okay
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md rounded-3xl shadow-float p-8 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Record Settlement</h3>
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Who Paid?</label>
            <select
              value={payerId}
              onChange={(e) => handlePayerChange(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white appearance-none transition-all cursor-pointer focus:ring-1 focus:ring-brand-primary"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id} className="bg-brand-bg text-white">
                  {member.full_name || 'Member'} ({member.username}) {member.id === currentUserId ? ' - You' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Who was Paid?</label>
            <select
              value={payeeId}
              onChange={(e) => setPayeeId(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white appearance-none transition-all cursor-pointer focus:ring-1 focus:ring-brand-primary"
            >
              {members
                .filter((m) => m.id !== payerId)
                .map((member) => (
                  <option key={member.id} value={member.id} className="bg-brand-bg text-white">
                    {member.full_name || 'Member'} ({member.username}) {member.id === currentUserId ? ' - You' : ''}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Amount ({getCurrencySymbol(groupCurrency)})</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">{getCurrencySymbol(groupCurrency)}</span>
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
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-indigo-400 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              {loading ? 'Recording...' : 'Settle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
