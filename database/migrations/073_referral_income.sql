-- ============================================================
--  Migration 073: Referral income tracking
-- ============================================================

-- ─── 1. REFERRAL INCOME RATES (per-user overrides) ───────────

CREATE TABLE IF NOT EXISTS referral_income_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  basic_rate NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  pro_rate NUMERIC(5,3) NOT NULL DEFAULT 0.6,
  enterprise_rate NUMERIC(5,3) NOT NULL DEFAULT 0.3,
  assigned_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_income_rates_referrer ON referral_income_rates(referrer_user_id, is_active);

ALTER TABLE referral_income_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_income_rates_admin_manage" ON referral_income_rates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
  );

-- ─── 2. REFERRAL INCOME (per-subscription earnings) ──────────

CREATE TABLE IF NOT EXISTS referral_income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id),
  plan_name VARCHAR(50) NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  income_rate NUMERIC(5,3) NOT NULL,
  income_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_income_referrer ON referral_income(referrer_user_id, created_at DESC);
CREATE INDEX idx_referral_income_referred ON referral_income(referred_user_id);

ALTER TABLE referral_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_income_referrer" ON referral_income
  FOR SELECT USING (
    referrer_user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())
  );

CREATE POLICY "referral_income_admin_all" ON referral_income
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
  );

-- ─── 3. ADD first subscription columns to referral_signups ────

ALTER TABLE referral_signups ADD COLUMN IF NOT EXISTS first_subscription_at TIMESTAMPTZ;
ALTER TABLE referral_signups ADD COLUMN IF NOT EXISTS first_plan_name VARCHAR(50);
ALTER TABLE referral_signups ADD COLUMN IF NOT EXISTS first_payment_amount NUMERIC(12,2);

-- ─── 4. RPC: get referral income summary ─────────────────────

CREATE OR REPLACE FUNCTION get_referral_income_summary(p_referrer_id UUID)
RETURNS TABLE (
  total_earned NUMERIC(12,2),
  total_pending NUMERIC(12,2),
  total_paid NUMERIC(12,2),
  total_referrals BIGINT,
  active_referrals BIGINT,
  by_plan JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ri.income_amount), 0)::NUMERIC(12,2) AS total_earned,
    COALESCE(SUM(CASE WHEN ri.status = 'pending' THEN ri.income_amount ELSE 0 END), 0)::NUMERIC(12,2) AS total_pending,
    COALESCE(SUM(CASE WHEN ri.status = 'paid' THEN ri.income_amount ELSE 0 END), 0)::NUMERIC(12,2) AS total_paid,
    (SELECT COUNT(*)::BIGINT FROM referral_signups WHERE referrer_user_id = p_referrer_id) AS total_referrals,
    (SELECT COUNT(*)::BIGINT FROM referral_signups rs
      JOIN users u ON u.id = rs.referred_user_id
      WHERE rs.referrer_user_id = p_referrer_id
        AND u.subscription_status = 'active') AS active_referrals,
    COALESCE(
      (SELECT jsonb_object_agg(ri.plan_name, jsonb_build_object(
        'count', sub.cnt,
        'total_income', sub.total
      ))
      FROM (
        SELECT plan_name, COUNT(*) AS cnt, SUM(income_amount) AS total
        FROM referral_income
        WHERE referrer_user_id = p_referrer_id
        GROUP BY plan_name
      ) sub
    ), '{}'::JSONB) AS by_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
