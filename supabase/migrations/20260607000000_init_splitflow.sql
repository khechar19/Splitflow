-- SQL Migration File for SplitFlow Expense Splitting App

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT group_members_group_profile_key UNIQUE (group_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  paid_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  split_type text NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage')),
  receipt_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  share numeric(12,4) NOT NULL,
  CONSTRAINT expense_splits_expense_profile_key UNIQUE (expense_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  payer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  payee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- 2. Security helper functions to prevent policy recursion
CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_uuid AND profile_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Row Level Security Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow profile insertion during user creation" ON public.profiles;
CREATE POLICY "Allow profile insertion during user creation" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups Policies
DROP POLICY IF EXISTS "Allow members to view groups" ON public.groups;
CREATE POLICY "Allow members to view groups" ON public.groups
  FOR SELECT USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Allow authenticated users to create groups" ON public.groups;
CREATE POLICY "Allow authenticated users to create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow members to update groups" ON public.groups;
CREATE POLICY "Allow members to update groups" ON public.groups
  FOR UPDATE USING (public.is_group_member(id, auth.uid()));

-- Group Members Policies
DROP POLICY IF EXISTS "Allow members to view other group members" ON public.group_members;
CREATE POLICY "Allow members to view other group members" ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()) OR profile_id = auth.uid());

DROP POLICY IF EXISTS "Allow members to add members to groups" ON public.group_members;
CREATE POLICY "Allow members to add members to groups" ON public.group_members
  FOR INSERT WITH CHECK (profile_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Allow members to remove members from groups" ON public.group_members;
CREATE POLICY "Allow members to remove members from groups" ON public.group_members
  FOR DELETE USING (profile_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid()
  ));

-- Expenses Policies
DROP POLICY IF EXISTS "Allow members to view group expenses" ON public.expenses;
CREATE POLICY "Allow members to view group expenses" ON public.expenses
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Allow members to create group expenses" ON public.expenses;
CREATE POLICY "Allow members to create group expenses" ON public.expenses
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()) AND paid_by = auth.uid());

DROP POLICY IF EXISTS "Allow creator to update/delete group expenses" ON public.expenses;
CREATE POLICY "Allow creator to update/delete group expenses" ON public.expenses
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()) AND paid_by = auth.uid());

DROP POLICY IF EXISTS "Allow creator to delete group expenses" ON public.expenses;
CREATE POLICY "Allow creator to delete group expenses" ON public.expenses
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()) AND paid_by = auth.uid());

-- Expense Splits Policies
DROP POLICY IF EXISTS "Allow members to view expense splits" ON public.expense_splits;
CREATE POLICY "Allow members to view expense splits" ON public.expense_splits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.expenses WHERE expenses.id = expense_id AND public.is_group_member(expenses.group_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Allow members to create splits" ON public.expense_splits;
CREATE POLICY "Allow members to create splits" ON public.expense_splits
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses WHERE expenses.id = expense_id AND public.is_group_member(expenses.group_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Allow members to update splits" ON public.expense_splits;
CREATE POLICY "Allow members to update splits" ON public.expense_splits
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.expenses WHERE expenses.id = expense_id AND public.is_group_member(expenses.group_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Allow members to delete splits" ON public.expense_splits;
CREATE POLICY "Allow members to delete splits" ON public.expense_splits
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.expenses WHERE expenses.id = expense_id AND public.is_group_member(expenses.group_id, auth.uid())
  ));

-- Settlements Policies
DROP POLICY IF EXISTS "Allow members to view settlements" ON public.settlements;
CREATE POLICY "Allow members to view settlements" ON public.settlements
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Allow members to create settlements" ON public.settlements;
CREATE POLICY "Allow members to create settlements" ON public.settlements
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()) AND (payer_id = auth.uid() OR payee_id = auth.uid()));

DROP POLICY IF EXISTS "Allow members to update settlements" ON public.settlements;
CREATE POLICY "Allow members to update settlements" ON public.settlements
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()) AND (payer_id = auth.uid() OR payee_id = auth.uid()));

DROP POLICY IF EXISTS "Allow members to delete settlements" ON public.settlements;
CREATE POLICY "Allow members to delete settlements" ON public.settlements
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()) AND (payer_id = auth.uid() OR payee_id = auth.uid()));


-- 4. Automatically handle profile creation and username generation on signup
CREATE OR REPLACE FUNCTION public.generate_unique_username()
RETURNS trigger AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  digits text := '0123456789';
  new_username text;
  is_unique boolean := false;
  attempts integer := 0;
BEGIN
  -- If username is already supplied and starts with @, keep it
  IF NEW.username IS NOT NULL AND NEW.username LIKE '@%' THEN
    RETURN NEW;
  END IF;

  LOOP
    -- Format: @AB1234 (starts with @, then 2 random letters, then 4 random digits)
    new_username := '@' 
      || substr(chars, floor(random() * 26)::int + 1, 1)
      || substr(chars, floor(random() * 26)::int + 1, 1)
      || substr(digits, floor(random() * 10)::int + 1, 1)
      || substr(digits, floor(random() * 10)::int + 1, 1)
      || substr(digits, floor(random() * 10)::int + 1, 1)
      || substr(digits, floor(random() * 10)::int + 1, 1);
      
    SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE username = new_username) INTO is_unique;
    
    IF is_unique THEN
      NEW.username := new_username;
      EXIT;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate a unique username after 100 attempts';
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_profile_inserted ON public.profiles;
CREATE TRIGGER before_profile_inserted
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_unique_username();


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      'https://ui-avatars.com/api/?name=' || COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '&background=6366F1&color=fff'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. Storage Buckets and Policies
-- Ensure the storage schema exists and create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for receipts storage
DROP POLICY IF EXISTS "Allow public read of receipts" ON storage.objects;
CREATE POLICY "Allow public read of receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow auth upload of receipts" ON storage.objects;
CREATE POLICY "Allow auth upload of receipts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');
