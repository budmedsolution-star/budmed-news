-- ============================================
-- BudMed News — Supabase Schema
-- Premium Access: Double Opt-In + Invite Codes
-- ============================================

-- 1. Premium codes (generated after email verification)
CREATE TABLE IF NOT EXISTS premium_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT false,
  UNIQUE(email, code)
);

CREATE INDEX idx_premium_codes_email ON premium_codes(email);
CREATE INDEX idx_premium_codes_code ON premium_codes(code);
CREATE INDEX idx_premium_codes_expires ON premium_codes(expires_at);

-- 2. Rate limiting (brute force protection)
CREATE TABLE IF NOT EXISTS premium_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('send_code', 'verify_code')),
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_premium_attempts_email ON premium_attempts(email);
CREATE INDEX idx_premium_attempts_created ON premium_attempts(created_at);

-- 3. Email verifications (Double Opt-In)
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_email_verifications_token ON email_verifications(token);
CREATE INDEX idx_email_verifications_email ON email_verifications(email);

-- 4. Active sessions (for logged-in users)
CREATE TABLE IF NOT EXISTS premium_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_premium_sessions_token ON premium_sessions(session_token);

-- ============================================
-- Helper Functions
-- ============================================

-- Check rate limit: max N attempts per hour per email+type
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_email TEXT,
  p_type TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INT;
BEGIN
  SELECT count(*) INTO attempt_count
  FROM premium_attempts
  WHERE email = p_email
    AND attempt_type = p_type
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;

  RETURN attempt_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql;

-- Record attempt
CREATE OR REPLACE FUNCTION record_attempt(
  p_email TEXT,
  p_type TEXT,
  p_ip TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO premium_attempts (email, ip_address, attempt_type, success)
  VALUES (p_email, p_ip, p_type, p_success);
END;
$$ LANGUAGE plpgsql;

-- Validate and use code
CREATE OR REPLACE FUNCTION validate_premium_code(
  p_code TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE(valid BOOLEAN, email TEXT, message TEXT) AS $$
DECLARE
  code_record RECORD;
BEGIN
  SELECT * INTO code_record
  FROM premium_codes
  WHERE code = upper(trim(p_code))
    AND expires_at > now()
    AND used_at IS NULL
    AND verified = true
  LIMIT 1;

  IF code_record IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, 'Invalid or expired code'::TEXT;
    RETURN;
  END IF;

  -- Mark as used
  UPDATE premium_codes SET used_at = now() WHERE id = code_record.id;

  -- Create session
  INSERT INTO premium_sessions (email, session_token, expires_at)
  VALUES (code_record.email, encode(gen_random_bytes(32), 'hex'), now() + interval '30 days');

  RETURN QUERY SELECT true, code_record.email, 'Access granted'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS (Row Level Security) — enable per table
-- ============================================
ALTER TABLE premium_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anon (public) access for our functions
-- In production, use service_role key for edge functions
CREATE POLICY "Allow anon insert on premium_codes" ON premium_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon select on premium_codes" ON premium_codes
  FOR SELECT USING (true);

CREATE POLICY "Allow anon update on premium_codes" ON premium_codes
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon insert on premium_attempts" ON premium_attempts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon select on premium_attempts" ON premium_attempts
  FOR SELECT USING (true);

CREATE POLICY "Allow anon insert on email_verifications" ON email_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon select on email_verifications" ON email_verifications
  FOR SELECT USING (true);

CREATE POLICY "Allow anon update on email_verifications" ON email_verifications
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon insert on premium_sessions" ON premium_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon select on premium_sessions" ON premium_sessions
  FOR SELECT USING (true);
