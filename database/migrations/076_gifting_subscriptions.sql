-- ============================================================
--  QSToolkit — Migration 076
--  Gifting & Gifted Subscriptions (V1.20)
--  1. gift_batches      — one row per donor checkout (one Flutterwave payment)
--  2. gift_recipients   — one row per beneficiary, per-recipient state machine
--  3. Relax billing_transactions.user_id to allow batch-level donor rows
--  See docs/adr/0002-gift-subscriptions-batch-model.md
-- ============================================================

-- ── 1. Gift batches ───────────────────────────────────────────
-- One donor payment can gift N recipients. donor_email/donor_name are
-- nullable: an anonymous gift has no identity columns at all.
CREATE TABLE IF NOT EXISTS public.gift_batches (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Donor (all nullable → fully anonymous gifting supported)
  donor_user_id      UUID REFERENCES public.users(id),   -- set only when a logged-in user gifts
  donor_name         VARCHAR(255),
  donor_email        VARCHAR(255),
  donor_title        VARCHAR(255),                       -- e.g. "Senior QS"
  donor_company      VARCHAR(255),
  donor_role         VARCHAR(255),
  is_anonymous       BOOLEAN NOT NULL DEFAULT FALSE,
  donor_note         TEXT,                               -- "why I chose to support young QS professionals"
  -- What is being gifted (same plan + cycle for the whole batch)
  plan_name          VARCHAR(50) NOT NULL,
  billing_cycle      VARCHAR(10) NOT NULL DEFAULT 'monthly'
                       CHECK (billing_cycle IN ('monthly', 'annual')),
  amount_ngn         NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency           VARCHAR(3) NOT NULL DEFAULT 'NGN',
  -- Payment tracking
  payment_status     VARCHAR(30) NOT NULL DEFAULT 'pending'
                       CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_reference  VARCHAR(255) UNIQUE,                -- Flutterwave tx_ref ('gift-…') — idempotency key
  amount_paid        NUMERIC(12,2),
  flw_transaction_id VARCHAR(100),
  -- Fan-out tracking
  recipient_count    INT NOT NULL DEFAULT 0,
  activated_count    INT NOT NULL DEFAULT 0,
  failed_count       INT NOT NULL DEFAULT 0,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_batches_payment_status
  ON public.gift_batches (payment_status);
CREATE INDEX IF NOT EXISTS idx_gift_batches_donor_email
  ON public.gift_batches (donor_email) WHERE donor_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_batches_created_at
  ON public.gift_batches (created_at DESC);

COMMENT ON TABLE public.gift_batches IS
  'One donor gifting checkout = one Flutterwave payment covering N gift_recipients.';

-- ── 2. Gift recipients ────────────────────────────────────────
-- Per-beneficiary state machine. gift_message snapshot preserves the note
-- exactly as the donor wrote it at purchase time.
CREATE TABLE IF NOT EXISTS public.gift_recipients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id          UUID NOT NULL REFERENCES public.gift_batches(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.users(id),   -- resolved from email at checkout
  recipient_email   VARCHAR(255) NOT NULL,              -- lowercased at insert; lookup key
  recipient_name    VARCHAR(255),                       -- snapshot for analytics/emails
  plan_name         VARCHAR(50) NOT NULL,
  billing_cycle     VARCHAR(10) NOT NULL DEFAULT 'monthly',
  gift_message      TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'activated', 'failed', 'removed')),
  failure_reason    TEXT,
  activated_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One recipient per user per batch (prevents double-gifting one user inside a checkout)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_recipients_batch_user
  ON public.gift_recipients (batch_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), recipient_email);

-- Fast lookup: "has this user been gifted?" (activation + analytics)
CREATE INDEX IF NOT EXISTS idx_gift_recipients_user_status
  ON public.gift_recipients (user_id, status) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_recipients_batch
  ON public.gift_recipients (batch_id);
CREATE INDEX IF NOT EXISTS idx_gift_recipients_email
  ON public.gift_recipients (recipient_email);

COMMENT ON TABLE public.gift_recipients IS
  'Per-beneficiary rows fanned out from a gift_batches payment; activated independently.';

-- ── 3. billing_transactions.user_id must be nullable ──────────
-- Batch payments belong to the donor, who may be anonymous (no users row).
-- Individual recipient activations are intentionally NOT billed again —
-- the single batch row + gift_* tables are the audit trail.
ALTER TABLE public.billing_transactions ALTER COLUMN user_id DROP NOT NULL;

-- ── 4. updated_at trigger for gift_batches ────────────────────
CREATE OR REPLACE FUNCTION update_gift_batches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_batches_updated_at ON public.gift_batches;
CREATE TRIGGER trg_gift_batches_updated_at
  BEFORE UPDATE ON public.gift_batches
  FOR EACH ROW EXECUTE FUNCTION update_gift_batches_timestamp();

-- ── 5. RLS: service-role only (backend uses service key) ──────
ALTER TABLE public.gift_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_recipients ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get nothing; backend uses service role which bypasses RLS.
