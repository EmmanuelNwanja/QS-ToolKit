-- Migration 040: Flutterwave recurring subscriptions + plan change support
--
-- Adds Flutterwave plan ID mapping to subscription_plans,
-- customer/subscription token storage on users.

BEGIN;

-- ── Flutterwave plan mapping ──────────────────────────────────
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS flutterwave_plan_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS flutterwave_plan_id_annual VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_flw_plan
  ON subscription_plans(flutterwave_plan_id)
  WHERE flutterwave_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_flw_plan_annual
  ON subscription_plans(flutterwave_plan_id_annual)
  WHERE flutterwave_plan_id_annual IS NOT NULL;

-- ── Flutterwave customer tokenization ─────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS flutterwave_customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS flutterwave_subscription_id VARCHAR(100);

-- ── Backfill project tag on existing billing transactions ──────
UPDATE billing_transactions
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"project": "qstoolkit"}'::jsonb
WHERE metadata->>'project' IS NULL;

COMMIT;
