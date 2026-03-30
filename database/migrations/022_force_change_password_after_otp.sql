-- Migration: 022_force_change_password_after_otp.sql
-- Purpose: Force users to change password after OTP-based login
-- Created: 2026-03-30

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_force_password_change
  ON users(force_password_change)
  WHERE force_password_change = TRUE;

COMMIT;