-- Migration: create_supabase_schema.sql
-- Creates profiles, books, payments tables and RLS policies expected by the app.

-- NOTE: Run this in Supabase SQL editor or via supabase CLI. Review before executing.

BEGIN;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  full_name text,
  role text DEFAULT 'user',
  purchased_books text[] DEFAULT ARRAY[]::text[],
  subscription jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Books
CREATE TABLE IF NOT EXISTS public.books (
  id text PRIMARY KEY,
  title text,
  language text,
  level text,
  price integer,
  price_individual integer,
  author text,
  is_published boolean DEFAULT false,
  cover_url text,
  created_at timestamptz DEFAULT now()
);

-- Payments (server-driven table)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  type text,
  book_id text REFERENCES public.books(id) ON DELETE SET NULL,
  amount_paise integer,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- Enable RLS and policies
-- Profiles policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Owner can select their profile
CREATE POLICY IF NOT EXISTS "profiles_select_owner" ON public.profiles FOR SELECT USING (auth.uid() = id::text);
-- Admins can select any profile
CREATE POLICY IF NOT EXISTS "profiles_select_admin" ON public.profiles FOR SELECT USING (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);
-- Allow authenticated users to insert their own profile (id must match auth.uid())
CREATE POLICY IF NOT EXISTS "profiles_insert_owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id::text);
-- Allow owner to update their profile
CREATE POLICY IF NOT EXISTS "profiles_update_owner" ON public.profiles FOR UPDATE USING (auth.uid() = id::text) WITH CHECK (auth.uid() = id::text);
-- Allow admins to update/delete
CREATE POLICY IF NOT EXISTS "profiles_update_admin" ON public.profiles FOR UPDATE USING (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
) WITH CHECK (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);
CREATE POLICY IF NOT EXISTS "profiles_delete_admin" ON public.profiles FOR DELETE USING (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);

-- Books policies
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
-- Public can read published books; admins can read all
CREATE POLICY IF NOT EXISTS "books_select_public_or_admin" ON public.books FOR SELECT USING (
  is_published = true OR exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);
-- Only admins may insert/update/delete
CREATE POLICY IF NOT EXISTS "books_modify_admin" ON public.books FOR INSERT USING (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
) WITH CHECK (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);
CREATE POLICY IF NOT EXISTS "books_update_admin" ON public.books FOR UPDATE USING (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
) WITH CHECK (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);
CREATE POLICY IF NOT EXISTS "books_delete_admin" ON public.books FOR DELETE USING (
  exists (select 1 from public.profiles p where p.id::text = auth.uid() and p.role = 'admin')
);

-- Payments policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- Allow users to SELECT their own payments
CREATE POLICY IF NOT EXISTS "payments_select_owner" ON public.payments FOR SELECT USING (user_id::text = auth.uid());
-- Prevent client inserts/updates/deletes (server/service_role key will bypass RLS)
CREATE POLICY IF NOT EXISTS "payments_no_client_insert" ON public.payments FOR INSERT USING (false);
CREATE POLICY IF NOT EXISTS "payments_no_client_update" ON public.payments FOR UPDATE USING (false);
CREATE POLICY IF NOT EXISTS "payments_no_client_delete" ON public.payments FOR DELETE USING (false);

COMMIT;
