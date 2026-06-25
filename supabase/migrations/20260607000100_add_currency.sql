-- SQL Migration to add Currency Support

-- Add currency column to profiles (user's home display currency preference)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency column to groups (the currency that this group operates in)
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
