-- ============================================================
--  QSToolkit - Seed Data
--  (Plans are seeded in migration 001; this seeds demo data)
--  NOTE: Only run in development/staging, not production
-- ============================================================

-- Confirm plans exist (idempotent)
INSERT INTO subscription_plans (name, price_monthly, max_projects, max_calculator_uses, max_users, max_devices, has_invoice_maker, has_pdf_export, has_excel_export, max_boq, max_invoices)
VALUES
  ('free',       0,      0,   3,   1,  1, FALSE, FALSE, FALSE, 0,   0),
  ('basic',   5000,      2,  30,   1,  1, TRUE,  TRUE,  TRUE,  2,   2),
  ('pro',    15000,      5,  80,   1,  2, TRUE,  TRUE,  TRUE,  5,   5),
  ('enterprise',70000,  50, 700,   5, 15, TRUE,  TRUE,  TRUE,  50, 50)
ON CONFLICT DO NOTHING;
