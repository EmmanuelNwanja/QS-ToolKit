-- ============================================================
--  Migration 068: Enable AI features for all tiers
--  Fixes: enabled_globally was FALSE on all AI features,
--  blocking every user regardless of plan.
-- ============================================================

-- ─── 1. FEATURE FLAGS ─────────────────────────────────────────
-- ai_chat, variance_detection, document_integrity: open to all tiers
-- (rate limits handle per-tier usage caps)
UPDATE feature_flags
SET enabled_globally = TRUE,
    enabled_for_plans = ARRAY['free','basic','pro','enterprise']::text[],
    updated_at = NOW()
WHERE feature_key IN ('ai_chat', 'variance_detection', 'document_integrity');

-- auto_boq_drawings, cost_forecasting, smart_rates: pro/enterprise only
UPDATE feature_flags
SET enabled_globally = TRUE,
    updated_at = NOW()
WHERE feature_key IN ('auto_boq_drawings', 'cost_forecasting', 'smart_rates');

-- admin_ai: unchanged (enterprise-only, enabled_globally stays FALSE)

-- ─── 2. FIX RATE LIMIT TIER NAME ──────────────────────────────
-- Migration 013 renamed 'student' -> 'basic' in subscription_plans,
-- but migration 055 still used 'student' in rate_limit_config.
UPDATE rate_limit_config SET tier = 'basic' WHERE tier = 'student';
