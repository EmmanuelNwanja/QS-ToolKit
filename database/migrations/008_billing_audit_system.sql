-- Migration 008: Billing Audit System
-- Adds tables for transaction tracking, refunds, and billing audits

-- Create billing_transactions table for tracking all financial transactions
CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  type VARCHAR(50) NOT NULL, -- 'payment', 'refund', 'credit', 'adjustment'
  status VARCHAR(50) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  paystack_reference VARCHAR(255),
  description TEXT,
  metadata JSONB,
  related_refund_id UUID REFERENCES billing_transactions(id),
  transaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_billing_transactions_user_id ON billing_transactions(user_id);
CREATE INDEX idx_billing_transactions_type ON billing_transactions(type);
CREATE INDEX idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX idx_billing_transactions_date ON billing_transactions(transaction_date);
CREATE INDEX idx_billing_transactions_paystack_ref ON billing_transactions(paystack_reference);

-- Add account_credit column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_credit DECIMAL(10, 2) DEFAULT 0;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS billing_transactions_updated_at ON billing_transactions;
CREATE TRIGGER billing_transactions_updated_at
  BEFORE UPDATE ON billing_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_transactions_timestamp();

-- Add helpful comment about table structure
COMMENT ON TABLE billing_transactions IS 'Tracks all financial transactions via Paystack: payments, refunds, credits, and adjustments for audit compliance';
COMMENT ON COLUMN billing_transactions.type IS 'payment: subscription charge, refund: customer refund, credit: account credit, adjustment: admin adjustment';
COMMENT ON COLUMN billing_transactions.status IS 'pending: awaiting processing, completed: processed successfully, failed: transaction failed';
COMMENT ON COLUMN billing_transactions.metadata IS 'JSON field for storing additional context like refund reason, refund method, timestamps';
COMMENT ON COLUMN billing_transactions.related_refund_id IS 'Link refund transactions back to original payment for tracking';
COMMENT ON COLUMN billing_transactions.currency IS 'Currency code (NGN for Nigerian Naira) - tracked per transaction for multi-currency support';
