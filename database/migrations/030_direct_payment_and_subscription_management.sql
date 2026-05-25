-- Migration 030: Direct Payment & Subscription Management System
-- Enables manual payment verification by admins and comprehensive subscription lifecycle tracking

-- Create direct_payment_submissions table for bank transfer tracking
CREATE TABLE IF NOT EXISTS direct_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(50) NOT NULL, -- 'basic', 'pro', 'enterprise'
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly' or 'annual'
  amount_ngn DECIMAL(12, 2) NOT NULL,
  receipt_url VARCHAR(512),
  reference_note VARCHAR(255), -- User's bank transaction reference
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  rejection_reason TEXT,
  admin_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_payments_user ON direct_payment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_direct_payments_status ON direct_payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_direct_payments_submitted_at ON direct_payment_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_payments_reviewed_by ON direct_payment_submissions(reviewed_by);

-- Create user_subscriptions table for comprehensive subscription tracking
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free', 'basic', 'pro', 'enterprise'
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly' or 'annual'
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled', 'suspended'
  subscription_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription_expires_at TIMESTAMPTZ,
  subscription_cancelled_at TIMESTAMPTZ,
  grace_period_until TIMESTAMPTZ, -- After expiry, users can still access for N days
  reminder_sent_7d BOOLEAN DEFAULT FALSE, -- Track reminders sent
  reminder_sent_3d BOOLEAN DEFAULT FALSE,
  reminder_sent_1d BOOLEAN DEFAULT FALSE,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  last_payment_id UUID REFERENCES billing_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires ON user_subscriptions(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_auto_renew ON user_subscriptions(auto_renew);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_unique_user ON user_subscriptions(user_id) WHERE subscription_status != 'cancelled';

-- Extend billing_transactions table for admin-approved payments (use IF NOT EXISTS for safety)
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS admin_upgraded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50) DEFAULT 'paystack'; -- 'paystack' or 'direct_transfer'
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255);
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS bank_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscription_transactions_payment_channel ON billing_transactions(payment_channel);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_admin_upgraded ON billing_transactions(admin_upgraded_by);

-- Create subscription_audit_log for compliance & tracking
CREATE TABLE IF NOT EXISTS subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'subscription_activated', 'subscription_expired', 'downgrade_to_free', 'reminder_sent', etc.
  plan_from VARCHAR(50),
  plan_to VARCHAR(50),
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = system, otherwise admin user_id
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_user ON subscription_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_action ON subscription_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_created ON subscription_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_triggered_by ON subscription_audit_log(triggered_by);

-- Create function to update updated_at timestamp for direct payments
CREATE OR REPLACE FUNCTION update_direct_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS direct_payments_updated_at ON direct_payment_submissions;
CREATE TRIGGER direct_payments_updated_at
  BEFORE UPDATE ON direct_payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_direct_payment_timestamp();

-- Create function to update updated_at for user subscriptions
CREATE OR REPLACE FUNCTION update_user_subscriptions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_subscriptions_timestamp();

-- Add helpful comments
COMMENT ON TABLE direct_payment_submissions IS 'Tracks bank transfer submissions from users waiting for admin verification';
COMMENT ON TABLE user_subscriptions IS 'Comprehensive subscription lifecycle tracking per user including status, expiry, reminders, and grace periods';
COMMENT ON TABLE subscription_audit_log IS 'Audit trail of all subscription changes for compliance and troubleshooting';
COMMENT ON COLUMN direct_payment_submissions.status IS 'pending: awaiting review, verified: admin approved, rejected: admin rejected';
COMMENT ON COLUMN user_subscriptions.subscription_status IS 'active: user can access paid features, expired: subscription past due date, cancelled: user cancelled, suspended: admin action';
COMMENT ON COLUMN user_subscriptions.grace_period_until IS 'Allows continued access for N days after expiry before final downgrade';
