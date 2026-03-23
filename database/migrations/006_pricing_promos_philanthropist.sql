-- ============================================================
--  QSToolkit — Migration 006
--  1. Fix student price: ₦5 → ₦5,000
--  2. Add annual pricing (12% discount) to all plans
--  3. Add billing_cycle to users table
--  4. Create promo_codes table (student + pro only)
--  5. Create philanthropist_grants table
-- ============================================================


-- ── 1. Fix student price ──────────────────────────────────────
UPDATE public.subscription_plans
SET price_monthly = 5000
WHERE name = 'student';


-- ── 2. Add annual pricing column & populate ───────────────────
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_annual NUMERIC(12,2);

-- Annual = monthly × 12 × 0.88 (12% discount)
-- free:       0
-- student:    5,000  × 12 × 0.88 = 52,800
-- pro:        15,000 × 12 × 0.88 = 158,400
-- enterprise: 70,000 × 12 × 0.88 = 739,200
UPDATE public.subscription_plans SET price_annual =
  CASE name
    WHEN 'free'       THEN 0
    WHEN 'student'    THEN ROUND(5000  * 12 * 0.88, 2)
    WHEN 'pro'        THEN ROUND(15000 * 12 * 0.88, 2)
    WHEN 'enterprise' THEN ROUND(70000 * 12 * 0.88, 2)
  END;


-- ── 3. Add billing_cycle to users ─────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(10) DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual'));


-- ── 4. Promo codes (student + pro plans only) ─────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(50) UNIQUE NOT NULL,          -- e.g. NIQS2024
  description      TEXT,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  applicable_plans TEXT[] NOT NULL DEFAULT ARRAY['student', 'pro'], -- plans it works on
  max_uses         INT,                                  -- NULL = unlimited
  uses_count       INT DEFAULT 0,
  valid_from       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,                         -- NULL = no expiry
  is_active        BOOLEAN DEFAULT TRUE,
  created_by       UUID REFERENCES public.users(id),    -- admin who created it
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Track which users have used which promo codes (prevent re-use)
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_id    UUID REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan_name   VARCHAR(50),
  used_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (promo_id, user_id)                            -- one use per user per code
);

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code
  ON public.promo_codes (UPPER(code));                  -- case-insensitive lookups

-- RLS: promo codes are public read (users need to validate them)
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes_read"
  ON public.promo_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "promo_uses_own"
  ON public.promo_code_uses
  FOR ALL
  USING (user_id = (SELECT id FROM public.users WHERE supabase_auth_id = (SELECT auth.uid())));


-- ── 5. Philanthropist grants ──────────────────────────────────
-- A philanthropist pays for another user's subscription
CREATE TABLE IF NOT EXISTS public.philanthropist_grants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The person paying
  donor_name        VARCHAR(255),
  donor_email       VARCHAR(255) NOT NULL,
  -- The beneficiary (may not have an account yet at time of grant)
  beneficiary_email VARCHAR(255) NOT NULL,
  beneficiary_user_id UUID REFERENCES public.users(id), -- filled when account found/created
  -- What they're paying for
  plan_name         VARCHAR(50) NOT NULL,
  billing_cycle     VARCHAR(10) DEFAULT 'monthly',
  -- Payment tracking
  paystack_reference VARCHAR(255),
  amount_paid       NUMERIC(12,2),
  payment_status    VARCHAR(30) DEFAULT 'pending',      -- pending | paid | failed
  -- Grant tracking
  grant_status      VARCHAR(30) DEFAULT 'pending',      -- pending | active | expired | cancelled
  activated_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  message_to_beneficiary TEXT,                          -- optional personal message
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_philanthropist_grants_beneficiary_email
  ON public.philanthropist_grants (beneficiary_email);

CREATE INDEX IF NOT EXISTS idx_philanthropist_grants_beneficiary_user_id
  ON public.philanthropist_grants (beneficiary_user_id)
  WHERE beneficiary_user_id IS NOT NULL;

-- RLS: users can see grants made for them
ALTER TABLE public.philanthropist_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grants_beneficiary_read"
  ON public.philanthropist_grants
  FOR SELECT
  USING (
    beneficiary_user_id = (
      SELECT id FROM public.users WHERE supabase_auth_id = (SELECT auth.uid())
    )
    OR
    -- Donor can see their own grants (matched by email)
    donor_email = (
      SELECT email FROM public.users WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );


-- ── 6. Seed a demo promo code (remove in production) ─────────
-- INSERT INTO public.promo_codes (code, description, discount_percent, applicable_plans, max_uses)
-- VALUES ('NIQS2024', 'NIQS member discount 2024', 15, ARRAY['student','pro'], 500);
-- (Uncomment the above line to create an initial promo code after migration)


-- ── 7. Helper function: increment promo code uses atomically ──
CREATE OR REPLACE FUNCTION public.increment_promo_uses(p_promo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.promo_codes
  SET uses_count = uses_count + 1
  WHERE id = p_promo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_promo_uses(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_promo_uses(UUID) TO authenticated;
