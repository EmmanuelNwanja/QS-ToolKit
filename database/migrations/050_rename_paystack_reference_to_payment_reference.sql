-- ============================================================
--  Migration 050: Rename paystack_reference → payment_reference
--  Makes column names gateway-agnostic now that Flutterwave is primary
-- ============================================================

-- 1. billing_transactions
ALTER TABLE billing_transactions
  RENAME COLUMN paystack_reference TO payment_reference;

-- 2. philanthropist_grants
ALTER TABLE philanthropist_grants
  RENAME COLUMN paystack_reference TO payment_reference;

-- 3. academy_subscriptions
ALTER TABLE academy_subscriptions
  RENAME COLUMN paystack_reference TO payment_reference;

-- 4. exam_prep_subscriptions
ALTER TABLE exam_prep_subscriptions
  RENAME COLUMN paystack_reference TO payment_reference;
