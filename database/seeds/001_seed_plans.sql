-- ============================================================
--  QSToolkit - Seed Data
--  (Plans are seeded in migration 001; this seeds demo data)
--  NOTE: Only run in development/staging, not production
-- ============================================================

-- Confirm plans exist (idempotent)
INSERT INTO subscription_plans (name, price_monthly, max_projects, max_calculator_uses, max_users, max_devices, has_invoice_maker, has_pdf_export, has_excel_export)
VALUES
  ('free',       0,      0,   1,   1,  1, FALSE, FALSE, FALSE),
  ('student',    5,      7,   7,   1,  1, FALSE, FALSE, FALSE),
  ('pro',     15000,    15,  20,   1,  2, TRUE,  TRUE,  TRUE),
  ('enterprise',70000, 200, NULL,  5, 15, TRUE,  TRUE,  TRUE)
ON CONFLICT DO NOTHING;
