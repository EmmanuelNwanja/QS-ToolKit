-- Migration 009: Email verification + identity abuse controls

-- Stores one-time email verification tokens (hashed)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
  ON email_verification_tokens(expires_at);

-- Stores identity signals used to reduce free/student signup abuse
CREATE TABLE IF NOT EXISTS signup_identity_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  email_hash VARCHAR(128),
  device_id_hash VARCHAR(128) NOT NULL,
  ip_prefix VARCHAR(80) NOT NULL,
  user_agent TEXT,
  risk_score INT NOT NULL DEFAULT 0,
  decision VARCHAR(20) NOT NULL DEFAULT 'allow',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_identity_signals_device_hash
  ON signup_identity_signals(device_id_hash);
CREATE INDEX IF NOT EXISTS idx_signup_identity_signals_ip_prefix
  ON signup_identity_signals(ip_prefix);
CREATE INDEX IF NOT EXISTS idx_signup_identity_signals_email_hash
  ON signup_identity_signals(email_hash);
CREATE INDEX IF NOT EXISTS idx_signup_identity_signals_created_at
  ON signup_identity_signals(created_at);
