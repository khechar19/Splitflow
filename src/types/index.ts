// TypeScript Type Definitions for SplitFlow

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
  currency?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  currency?: string;
  members?: Profile[];
}

export interface GroupMember {
  id: string;
  group_id: string;
  profile_id: string;
  joined_at: string;
  profile?: Profile;
}

export type SplitType = 'equal' | 'exact' | 'percentage';

export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  amount: number;
  description: string;
  split_type: SplitType;
  receipt_url: string | null;
  created_at: string;
  payer?: Profile;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  profile_id: string;
  amount: number;
  share: number; // For 'equal', represents share count (e.g., 1); 'exact' = amount; 'percentage' = percent (0-100)
  profile?: Profile;
}

export interface Settlement {
  id: string;
  group_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  created_at: string;
  payer?: Profile;
  payee?: Profile;
}

// UI State & Calculation Interfaces
export interface UserBalance {
  profile: Profile;
  amount: number; // positive = they are owed, negative = they owe
}

export interface BalanceSheet {
  [profileId: string]: number; // net balance for each user ID
}

export interface Debt {
  from: string; // profileId
  to: string;   // profileId
  amount: number;
  fromProfile?: Profile;
  toProfile?: Profile;
}

export interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement' | 'group_created' | 'member_added';
  title: string;
  description: string;
  amount?: number;
  created_at: string;
  group_id: string;
  group_name?: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
}
