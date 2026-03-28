-- Migration: 020_subscription_renewal_tracking.sql
-- Purpose: Track auto-renewal attempts for audit and debugging
-- Created: 2026-03-28

BEGIN;

-- Create table to track all subscription renewal attempts
CREATE TABLE IF NOT EXISTS subscription_renewal_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  plan_name VARCHAR(50),
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')),
  amount NUMERIC(10, 2),
  paystack_reference VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'completed', 'failed', 'pending_verification')),
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by user
CREATE INDEX idx_renewal_attempts_user_id ON subscription_renewal_attempts(user_id);

-- Index for failed attempts (admin debugging)
CREATE INDEX idx_renewal_attempts_status ON subscription_renewal_attempts(status, attempted_at DESC);

-- Index for finding attempts by Paystack reference (for webhook matching)
CREATE INDEX idx_renewal_attempts_paystack_ref ON subscription_renewal_attempts(paystack_reference)
  WHERE paystack_reference IS NOT NULL;

COMMIT;
