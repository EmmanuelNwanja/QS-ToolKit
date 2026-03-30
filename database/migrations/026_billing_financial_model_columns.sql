-- Migration 026: Add discount-aware financial reporting columns to billing_transactions
-- Purpose: support admin financial modelling with gross, discount, and net values

BEGIN;

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20),
  ADD COLUMN IF NOT EXISTS promo_id UUID,
  ADD COLUMN IF NOT EXISTS paystack_plan_code VARCHAR(100);

UPDATE billing_transactions
SET
  gross_amount = COALESCE(
    gross_amount,
    NULLIF(metadata->>'gross_amount', '')::NUMERIC,
    CASE
      WHEN type = 'payment' THEN COALESCE(amount, 0) + COALESCE(NULLIF(metadata->>'discount_applied', '')::NUMERIC, 0)
      ELSE ABS(COALESCE(amount, 0))
    END
  ),
  discount_amount = COALESCE(
    discount_amount,
    NULLIF(metadata->>'discount_amount', '')::NUMERIC,
    COALESCE(NULLIF(metadata->>'discount_applied', '')::NUMERIC, 0)
  ),
  net_amount = COALESCE(
    net_amount,
    NULLIF(metadata->>'net_amount', '')::NUMERIC,
    COALESCE(amount, 0)
  ),
  plan_name = COALESCE(plan_name, NULLIF(metadata->>'plan_name', '')),
  billing_cycle = COALESCE(billing_cycle, NULLIF(metadata->>'billing_cycle', '')),
  paystack_plan_code = COALESCE(paystack_plan_code, NULLIF(metadata->>'paystack_plan_code', ''));

UPDATE billing_transactions
SET promo_id = NULLIF(metadata->>'promo_id', '')::UUID
WHERE promo_id IS NULL
  AND COALESCE(metadata->>'promo_id', '') <> ''
  AND (metadata->>'promo_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

CREATE INDEX IF NOT EXISTS idx_billing_transactions_plan_name
  ON billing_transactions(plan_name);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_promo_id
  ON billing_transactions(promo_id)
  WHERE promo_id IS NOT NULL;

COMMIT;