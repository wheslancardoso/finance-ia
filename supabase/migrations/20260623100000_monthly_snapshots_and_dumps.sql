-- 1. Create the monthly_snapshots table to keep track of generated CSVs
CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month varchar(7) NOT NULL, -- Format: YYYY-MM
  file_path text NOT NULL, -- Path in Supabase Storage
  total_balance_cents bigint NOT NULL DEFAULT 0,
  total_income_cents bigint NOT NULL DEFAULT 0,
  total_expenses_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, reference_month)
);

-- Ensure user can only see their own snapshots
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly snapshots" 
ON public.monthly_snapshots FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly snapshots" 
ON public.monthly_snapshots FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 2. Create the bucket in storage.buckets if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('monthly_dumps', 'monthly_dumps', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage RLS policies for the new bucket
-- Only the owner can view and upload to their folder in monthly_dumps (e.g. userid/...)
CREATE POLICY "Users can upload their own dumps" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'monthly_dumps' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own dumps" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'monthly_dumps' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
