-- ============================================================
--  QSToolkit - Migration 016: BOQ and Invoice Monthly Limits
--  Adds max_boq and max_invoices columns to subscription_plans
--  so per-month limits can be enforced server-side.
--  max_invoices applies per-type (invoice / valuation / quotation / proforma)
-- ============================================================

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS max_boq INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_invoices INT DEFAULT NULL;

-- free: no access to BOQ or invoice creation
UPDATE subscription_plans SET max_boq = 0, max_invoices = 0 WHERE name = 'free';

-- basic: 2 BOQ/month, 2 per-type invoices/month
UPDATE subscription_plans SET max_boq = 2, max_invoices = 2 WHERE name = 'basic';

-- pro: 5 BOQ/month, 5 per-type invoices/month
UPDATE subscription_plans SET max_boq = 5, max_invoices = 5 WHERE name = 'pro';

-- enterprise: 50 BOQ/month, 50 per-type invoices/month (NULL = unlimited alternative)
UPDATE subscription_plans SET max_boq = 50, max_invoices = 50 WHERE name = 'enterprise';
