-- Migration 057: Promo code duration + card tokenization for auto-upgrade
--
-- 1. promo_codes.duration — 'permanent' (default) or 'first_month'
--    Controls whether a promo discount applies forever or only to the first billing cycle.
-- 2. users.card_token — Flutterwave tokenized card for server-side charges
--    Enables auto-renewal charges without re-entering card details.
-- 3. users.promo_upgraded — tracks if first-month promo was already upgraded to full price
--    Prevents double-upgrading when a first_month promo transitions to standard pricing.
-- 4. billing_transactions.promo_duration — tracks which promo type was used
--    Audit trail: which promo duration was active when this transaction was created.

BEGIN;

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS duration VARCHAR(20) NOT NULL DEFAULT 'permanent';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS card_token TEXT,
  ADD COLUMN IF NOT EXISTS promo_upgraded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS promo_duration VARCHAR(20);

COMMIT;
