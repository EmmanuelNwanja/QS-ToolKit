-- Migration 031: Platform Payment Settings
-- Adds configurable bank transfer settings for direct payment flow

CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(255) NOT NULL DEFAULT '',
  account_name VARCHAR(255) NOT NULL DEFAULT '',
  account_number VARCHAR(50) NOT NULL DEFAULT '',
  additional_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_payment_settings (bank_name, account_name, account_number, is_active)
VALUES ('Your Bank Name', 'Your Account Name', '0000000000', false);

CREATE INDEX IF NOT EXISTS idx_platform_payment_settings_active ON platform_payment_settings(is_active);
