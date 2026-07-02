-- ============================================================
--  Migration 048: Add country, currency, and gateway support
--  Enables multi-currency payments across Africa
-- ============================================================

-- 1. Add country/currency columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'NG',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS preferred_gateway text DEFAULT 'paystack';

-- 2. Add gateway columns to billing_transactions
ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS gateway_tx_ref text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS amount_local numeric;

-- 3. Add gateway columns to academy_subscriptions
ALTER TABLE academy_subscriptions
  ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS gateway_tx_ref text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS amount_local numeric;

-- 4. Add gateway columns to exam_prep_subscriptions
ALTER TABLE exam_prep_subscriptions
  ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS gateway_tx_ref text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS amount_local numeric;

-- 5. Index for gateway lookups
CREATE INDEX IF NOT EXISTS idx_billing_tx_gateway ON billing_transactions(gateway);
CREATE INDEX IF NOT EXISTS idx_billing_tx_gateway_ref ON billing_transactions(gateway_tx_ref) WHERE gateway_tx_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- 6. Create currency_prices table for per-country pricing
CREATE TABLE IF NOT EXISTS currency_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  currency text NOT NULL,
  amount_monthly numeric NOT NULL,
  amount_annual numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_name, currency)
);

-- 7. Seed currency prices (approximate conversions from NGN base prices)
-- Base: basic=8999/mo, pro=23999/mo, enterprise=84999/mo
INSERT INTO currency_prices (plan_name, currency, amount_monthly, amount_annual) VALUES
-- Nigeria (base)
('basic', 'NGN', 8999, 89990),
('pro', 'NGN', 23999, 239990),
('enterprise', 'NGN', 84999, 849990),
-- Ghana (GHS)
('basic', 'GHS', 580, 5800),
('pro', 'GHS', 1550, 15500),
('enterprise', 'GHS', 5480, 54800),
-- South Africa (ZAR)
('basic', 'ZAR', 487, 4870),
('pro', 'ZAR', 1298, 12980),
('enterprise', 'ZAR', 4595, 45950),
-- Kenya (KES)
('basic', 'KES', 5800, 58000),
('pro', 'KES', 15500, 155000),
('enterprise', 'KES', 54800, 548000),
-- Uganda (UGX)
('basic', 'UGX', 23700, 237000),
('pro', 'UGX', 63100, 631000),
('enterprise', 'UGX', 223700, 2237000),
-- Tanzania (TZS)
('basic', 'TZS', 36000, 360000),
('pro', 'TZS', 96000, 960000),
('enterprise', 'TZS', 340000, 3400000),
-- USD (international)
('basic', 'USD', 6, 58),
('pro', 'USD', 15, 155),
('enterprise', 'USD', 55, 548)
ON CONFLICT (plan_name, currency) DO NOTHING;

-- 8. Add academy/exam prep currency prices
CREATE TABLE IF NOT EXISTS addon_currency_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type text NOT NULL,  -- 'academy' or 'exam_prep'
  currency text NOT NULL,
  amount_weekly numeric NOT NULL,
  amount_monthly numeric NOT NULL,
  amount_annual numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_type, currency)
);

-- Addon prices (base: weekly=2000 NGN, monthly=7600 NGN, annual=93600 NGN)
INSERT INTO addon_currency_prices (product_type, currency, amount_weekly, amount_monthly, amount_annual) VALUES
('academy', 'NGN', 2000, 7600, 93600),
('academy', 'GHS', 13, 49, 604),
('academy', 'ZAR', 108, 411, 5060),
('academy', 'KES', 1290, 4890, 60400),
('academy', 'UGX', 5260, 20000, 246300),
('academy', 'TZS', 8000, 30400, 374400),
('academy', 'USD', 1.3, 4.9, 60),
('exam_prep', 'NGN', 2000, 7600, 93600),
('exam_prep', 'GHS', 13, 49, 604),
('exam_prep', 'ZAR', 108, 411, 5060),
('exam_prep', 'KES', 1290, 4890, 60400),
('exam_prep', 'UGX', 5260, 20000, 246300),
('exam_prep', 'TZS', 8000, 30400, 374400),
('exam_prep', 'USD', 1.3, 4.9, 60)
ON CONFLICT (product_type, currency) DO NOTHING;
