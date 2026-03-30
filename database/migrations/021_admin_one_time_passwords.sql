-- Migration: 021_admin_one_time_passwords.sql
-- Purpose: Support admin-issued one-time passwords for manual account recovery
-- Created: 2026-03-30

BEGIN;

CREATE TABLE IF NOT EXISTS admin_password_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_ip VARCHAR(50),
  used_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_password_otps_user_created
  ON admin_password_otps(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_password_otps_active
  ON admin_password_otps(user_id, expires_at)
  WHERE used_at IS NULL;

COMMIT;
