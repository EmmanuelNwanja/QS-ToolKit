-- ============================================================
--  Migration 072: Email OTP tokens for password reset + verification
-- ============================================================

CREATE TABLE IF NOT EXISTS email_otp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash VARCHAR(64) NOT NULL,        -- SHA-256 of the 6-digit code
  purpose VARCHAR(30) NOT NULL,          -- 'password_reset' or 'email_verification'
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eotp_user_purpose ON email_otp_tokens(user_id, purpose, used_at);
CREATE INDEX idx_eotp_expires ON email_otp_tokens(expires_at);

ALTER TABLE email_otp_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OTP tokens (for UI display if needed)
CREATE POLICY "email_otp_tokens_own" ON email_otp_tokens
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())
  );

-- Clean up expired OTPs (run periodically via cron or on each generate)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM email_otp_tokens WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
