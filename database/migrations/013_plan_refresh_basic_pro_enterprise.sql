-- ============================================================
--  QSToolkit - Migration 013: Plan Refresh
--  Rename student -> basic and update plan limits/features
-- ============================================================

-- Ensure there is only one active basic-tier record by renaming student first.
UPDATE subscription_plans
SET name = 'basic'
WHERE name = 'student';

UPDATE subscription_plans
SET
  price_monthly = 5000,
  max_projects = 2,
  max_calculator_uses = 30,
  max_users = 1,
  max_devices = 1,
  has_invoice_maker = TRUE,
  has_pdf_export = TRUE,
  has_excel_export = TRUE,
  is_active = TRUE
WHERE name = 'basic';

UPDATE subscription_plans
SET
  price_monthly = 15000,
  max_projects = 5,
  max_calculator_uses = 80,
  max_users = 1,
  max_devices = 2,
  has_invoice_maker = TRUE,
  has_pdf_export = TRUE,
  has_excel_export = TRUE,
  is_active = TRUE
WHERE name = 'pro';

UPDATE subscription_plans
SET
  price_monthly = 70000,
  max_projects = 50,
  max_calculator_uses = 700,
  max_users = 5,
  max_devices = 15,
  has_invoice_maker = TRUE,
  has_pdf_export = TRUE,
  has_excel_export = TRUE,
  is_active = TRUE
WHERE name = 'enterprise';

-- Keep free plan active and unchanged except explicit calculator limit baseline.
UPDATE subscription_plans
SET
  max_calculator_uses = COALESCE(max_calculator_uses, 3),
  is_active = TRUE
WHERE name = 'free';
