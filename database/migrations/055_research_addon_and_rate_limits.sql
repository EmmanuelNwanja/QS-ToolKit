-- ============================================================
--  Migration 055: Research Add-on + Rate Limits per Tier
-- ============================================================

-- ─── 1. RESEARCH SUBSCRIPTIONS ───────────────────────────────
-- Same pattern as academy_subscriptions / exam_prep_subscriptions

CREATE TABLE IF NOT EXISTS research_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired')),
  billing_cycle text NOT NULL DEFAULT 'weekly'
    CHECK (billing_cycle IN ('weekly', 'monthly', 'annual')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  payment_reference text,
  gateway text DEFAULT 'flutterwave',
  flutterwave_subscription_id text,
  flutterwave_customer_id text,
  amount numeric(12,2),
  currency text DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_sub_user ON research_subscriptions(user_id);
CREATE INDEX idx_research_sub_status ON research_subscriptions(status);
CREATE UNIQUE INDEX idx_research_sub_active_one_per_user ON research_subscriptions(user_id) WHERE status = 'active';

-- ─── 2. RESEARCH ADD-ON PRICES ───────────────────────────────
-- Add research to addon_currency_prices

INSERT INTO addon_currency_prices (product_type, currency, amount_weekly, amount_monthly, amount_annual) VALUES
('research', 'NGN', 3000, 11400, 140400),
('research', 'GHS', 19, 74, 906),
('research', 'ZAR', 162, 617, 7590),
('research', 'KES', 1935, 7335, 90600),
('research', 'UGX', 7890, 30000, 369450),
('research', 'TZS', 12000, 45600, 561600),
('research', 'USD', 1.95, 7.35, 90)
ON CONFLICT (product_type, currency) DO NOTHING;

-- ─── 3. RATE LIMIT CONFIG ────────────────────────────────────
-- Per-tier rate limits for AI and research features

CREATE TABLE IF NOT EXISTS rate_limit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL,
  feature text NOT NULL,
  max_uses_per_day integer NOT NULL,
  max_uses_per_week integer,
  max_uses_per_month integer,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tier, feature)
);

-- Free tier limits
INSERT INTO rate_limit_config (tier, feature, max_uses_per_day, max_uses_per_week, max_uses_per_month) VALUES
('free', 'ai_chat', 5, 25, 80),
('free', 'ai_lesson_generate', 2, 8, 25),
('free', 'ai_simulation_generate', 1, 4, 12),
('free', 'ai_exam_generate', 3, 15, 50),
('free', 'research_project_create', 1, 3, 10),
('free', 'research_ai_assist', 2, 8, 25),
('free', 'research_source_add', 5, 20, 60),
('free', 'cost_data_add', 5, 20, 60),

-- Student tier limits
('student', 'ai_chat', 15, 75, 250),
('student', 'ai_lesson_generate', 5, 25, 80),
('student', 'ai_simulation_generate', 3, 12, 40),
('student', 'ai_exam_generate', 10, 50, 160),
('student', 'research_project_create', 3, 10, 30),
('student', 'research_ai_assist', 5, 25, 80),
('student', 'research_source_add', 20, 100, 300),
('student', 'cost_data_add', 20, 100, 300),

-- Pro tier limits (generous)
('pro', 'ai_chat', 50, 300, 1000),
('pro', 'ai_lesson_generate', 20, 120, 400),
('pro', 'ai_simulation_generate', 10, 60, 200),
('pro', 'ai_exam_generate', 30, 180, 600),
('pro', 'research_project_create', 10, 50, 150),
('pro', 'research_ai_assist', 20, 120, 400),
('pro', 'research_source_add', 50, 300, 1000),
('pro', 'cost_data_add', 50, 300, 1000),

-- Enterprise tier (unlimited — set very high)
('enterprise', 'ai_chat', 9999, NULL, NULL),
('enterprise', 'ai_lesson_generate', 9999, NULL, NULL),
('enterprise', 'ai_simulation_generate', 9999, NULL, NULL),
('enterprise', 'ai_exam_generate', 9999, NULL, NULL),
('enterprise', 'research_project_create', 9999, NULL, NULL),
('enterprise', 'research_ai_assist', 9999, NULL, NULL),
('enterprise', 'research_source_add', 9999, NULL, NULL),
('enterprise', 'cost_data_add', 9999, NULL, NULL)

ON CONFLICT (tier, feature) DO UPDATE
  SET max_uses_per_day = EXCLUDED.max_uses_per_day,
      max_uses_per_week = EXCLUDED.max_uses_per_week,
      max_uses_per_month = EXCLUDED.max_uses_per_month;

-- ─── 4. USAGE TRACKING ───────────────────────────────────────
-- Track usage per user per feature per day

CREATE TABLE IF NOT EXISTS rate_limit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_rl_usage_user_feature ON rate_limit_usage(user_id, feature, used_at);

-- ─── 5. RLS POLICIES ────────────────────────────────────────

ALTER TABLE research_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "research_subscriptions_own" ON research_subscriptions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "rate_limit_config_read" ON rate_limit_config FOR SELECT USING (true);

CREATE POLICY "rate_limit_usage_own" ON rate_limit_usage
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- ─── 6. UPDATED_AT TRIGGER ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_research_sub_timestamp()
RETURNS trigger AS $$
BEGIN
  -- No updated_at column, but keep trigger for future use
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_subscriptions_updated ON research_subscriptions;
CREATE TRIGGER research_subscriptions_updated
  BEFORE UPDATE ON research_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_research_sub_timestamp();
