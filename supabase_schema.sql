-- =========================================================
-- Supabase PostgreSQL Schema for Email Health Checker & Outreach
-- Run this script in your Supabase Project -> SQL Editor -> Run
-- =========================================================

-- 1. Users Table (Stores user profiles linked to Supabase Auth UID)
CREATE TABLE IF NOT EXISTS public.users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Audits Table (Stores domain deliverability scan results)
CREATE TABLE IF NOT EXISTS public.audits (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  result_data TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_user_id ON public.audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_domain ON public.audits(domain);

-- 3. Outreach Scripts Table (Stores cold call scripts and battlecards)
CREATE TABLE IF NOT EXISTS public.outreach_scripts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  company_name TEXT,
  grade TEXT,
  score INTEGER,
  script_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_user_id ON public.outreach_scripts(user_id);

-- 4. Callers Table (Team members conducting phone outreach)
CREATE TABLE IF NOT EXISTS public.callers (
  id BIGSERIAL PRIMARY KEY,
  caller_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  fixed_code TEXT NOT NULL,
  email TEXT,
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_callers_key ON public.callers(caller_key);
CREATE INDEX IF NOT EXISTS idx_callers_code ON public.callers(fixed_code);

-- Pre-populate default team callers with instant passcodes (CALLER1, CALLER2, CALLER3, CALLER4)
INSERT INTO public.callers (caller_key, name, fixed_code, email)
VALUES 
  ('caller_1', 'Caller 1', 'CALLER1', 'caller1@company.com'),
  ('caller_2', 'Caller 2', 'CALLER2', 'caller2@company.com'),
  ('caller_3', 'Caller 3', 'CALLER3', 'caller3@company.com'),
  ('caller_4', 'Caller 4', 'CALLER4', 'caller4@company.com')
ON CONFLICT (caller_key) DO NOTHING;


-- 5. Lead Assignments Table (Dial sheet leads partition per caller)
CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id BIGSERIAL PRIMARY KEY,
  caller_key TEXT NOT NULL,
  caller_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  grade TEXT,
  score INTEGER,
  result_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  batch_id TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_caller ON public.lead_assignments(caller_key);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_status ON public.lead_assignments(status);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_domain ON public.lead_assignments(domain);

-- Enable Row Level Security (optional / standard in Supabase)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- Allow public service / authenticated role access policies with full INSERT/UPDATE/SELECT/DELETE support
CREATE POLICY "Public full access users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access audits" ON public.audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access scripts" ON public.outreach_scripts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access callers" ON public.callers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access assignments" ON public.lead_assignments FOR ALL USING (true) WITH CHECK (true);
