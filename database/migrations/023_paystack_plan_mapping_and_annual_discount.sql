-- Migration: 023_paystack_plan_mapping_and_annual_discount.sql
-- Purpose: Map app plans to Paystack recurring plan codes and change annual discount to 10%
-- Created: 2026-03-30

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS paystack_plan_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paystack_plan_code_annual VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_paystack_plan_code
  ON subscription_plans(paystack_plan_code)
  WHERE paystack_plan_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_paystack_plan_code_annual
  ON subscription_plans(paystack_plan_code_annual)
  WHERE paystack_plan_code_annual IS NOT NULL;

UPDATE subscription_plans
SET price_annual =
  CASE
    WHEN COALESCE(price_monthly, 0) <= 0 THEN 0
    ELSE ROUND(price_monthly * 12 * 0.90, 2)
  END
WHERE is_active = TRUE;

COMMIT;