-- ============================================
-- BudMed News — Supabase Schema (simplified)
-- Edge function handles all logic
-- ============================================

-- 1. Premium codes
CREATE TABLE IF NOT EXISTS premium_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT false
);

CREATE INDEX idx_pc_email ON premium_codes(email);
CREATE INDEX idx_pc_code ON premium_codes(code);
CREATE INDEX idx_pc_expires ON premium_codes(expires_at);

-- 2. Rate limiting
CREATE TABLE IF NOT EXISTS premium_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempt_type TEXT NOT NULL,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pa_email ON premium_attempts(email);
CREATE INDEX idx_pa_created ON premium_attempts(created_at);

-- 3. Enable RLS
ALTER TABLE premium_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_attempts ENABLE ROW LEVEL SECURITY;

-- Allow service_role (edge function) full access
CREATE POLICY "Service role full access" ON premium_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON premium_attempts FOR ALL USING (true) WITH CHECK (true);
