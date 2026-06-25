import { useMemo } from 'react';
import { Expense, Settlement, Profile, Debt } from '../types';

export function useBalances(
  members: Profile[],
  expenses: Expense[],
  settlements: Settlement[]
) {
  return useMemo(() => {
    const netBalances: { [profileId: string]: number } = {};

    // Initialize all members with 0 balance
    members.forEach((m) => {
      netBalances[m.id] = 0;
    });

    // 1. Process Expenses
    expenses.forEach((expense) => {
      const payerId = expense.paid_by;
      const amount = expense.amount;

      // Add full amount to the payer
      if (netBalances[payerId] !== undefined) {
        netBalances[payerId] += amount;
      }

      // Subtract split amounts from all participants
      if (expense.splits) {
        expense.splits.forEach((split) => {
          if (netBalances[split.profile_id] !== undefined) {
            netBalances[split.profile_id] -= split.amount;
          }
        });
      }
    });

    // 2. Process Settlements
    settlements.forEach((settlement) => {
      const payerId = settlement.payer_id; // Bob pays
      const payeeId = settlement.payee_id; // Alice receives
      const amount = settlement.amount;

      if (netBalances[payerId] !== undefined) {
        netBalances[payerId] += amount; // Bob owes less (balance increases towards 0)
      }
      if (netBalances[payeeId] !== undefined) {
        netBalances[payeeId] -= amount; // Alice is owed less (balance decreases towards 0)
      }
    });

    // Round balances to 2 decimal places to avoid floating point errors
    Object.keys(netBalances).forEach((id) => {
      netBalances[id] = Math.round(netBalances[id] * 100) / 100;
    });

    // 3. Calculate Debts (Greedy Transaction Minimization)
    const debtors: { id: string; balance: number }[] = [];
    const creditors: { id: string; balance: number }[] = [];

    Object.keys(netBalances).forEach((id) => {
      const bal = netBalances[id];
      if (bal < -0.01) {
        debtors.push({ id, balance: bal });
      } else if (bal > 0.01) {
        creditors.push({ id, balance: bal });
      }
    });

    // Sort debtors ascending (most negative first)
    debtors.sort((a, b) => a.balance - b.balance);
    // Sort creditors descending (most positive first)
    creditors.sort((a, b) => b.balance - a.balance);

    const debts: Debt[] = [];
    let debtorIdx = 0;
    let creditorIdx = 0;

    // Clone balances for minimization
    const debtorBals = debtors.map((d) => ({ ...d }));
    const creditorBals = creditors.map((c) => ({ ...c }));

    while (debtorIdx < debtorBals.length && creditorIdx < creditorBals.length) {
      const debtor = debtorBals[debtorIdx];
      const creditor = creditorBals[creditorIdx];

      const owesAmount = Math.abs(debtor.balance);
      const owedAmount = creditor.balance;

      const settledAmount = Math.min(owesAmount, owedAmount);
      const roundedAmount = Math.round(settledAmount * 100) / 100;

      if (roundedAmount > 0) {
        const fromProfile = members.find((m) => m.id === debtor.id);
        const toProfile = members.find((m) => m.id === creditor.id);

        debts.push({
          from: debtor.id,
          to: creditor.id,
          amount: roundedAmount,
          fromProfile,
          toProfile,
        });
      }

      debtor.balance += settledAmount;
      creditor.balance -= settledAmount;

      if (Math.abs(debtor.balance) < 0.01) {
        debtorIdx++;
      }
      if (Math.abs(creditor.balance) < 0.01) {
        creditorIdx++;
      }
    }

    return {
      netBalances,
      debts,
    };
  }, [members, expenses, settlements]);
}
