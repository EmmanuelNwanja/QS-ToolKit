-- Migration 025: Deduplicate subscription_plans and enforce unique name constraint
--
-- Root cause: subscription_plans has no UNIQUE constraint on name.
-- Running the seed file inserted duplicate rows for free/basic/pro/enterprise.
-- This leaves multiple rows with the same name, causing:
--   1. Admin UI showing duplicate plan entries
--   2. Paystack plan code conflict rejections when saving codes
--   3. resolveSubscriptionPlanByName returning the wrong (old) row without codes
--
-- Strategy:
--   - For each plan name, keep the row that has paystack_plan_code set (admin configured).
--     If none have codes, keep the most recently created row.
--   - Reassign users.plan_id pointing to deleted rows to the survivor.
--   - subscription_renewal_attempts.plan_id is ON DELETE SET NULL — handled automatically.
--   - Add UNIQUE constraint on name to prevent this from happening again.

BEGIN;

-- ── Step 1: Identify one survivor per plan name ──────────────
-- Priority: (a) has paystack_plan_code, (b) has paystack_plan_code_annual, (c) newest created_at
CREATE TEMP TABLE _plan_survivors AS
SELECT DISTINCT ON (name)
  id   AS survivor_id,
  name AS plan_name
FROM subscription_plans
ORDER BY
  name,
  (paystack_plan_code        IS NOT NULL) DESC,
  (paystack_plan_code_annual IS NOT NULL) DESC,
  created_at DESC;

-- ── Step 2: Reassign users pointing to non-survivor rows ─────
UPDATE users u
SET    plan_id = ps.survivor_id
FROM   subscription_plans sp
JOIN   _plan_survivors ps ON ps.plan_name = sp.name
WHERE  u.plan_id = sp.id
  AND  sp.id <> ps.survivor_id;

-- ── Step 3: Delete non-survivor rows ─────────────────────────
-- subscription_renewal_attempts.plan_id ON DELETE SET NULL handles those refs automatically.
DELETE FROM subscription_plans
WHERE id NOT IN (SELECT survivor_id FROM _plan_survivors);

-- ── Step 4: Enforce uniqueness going forward ──────────────────
ALTER TABLE subscription_plans
  ADD CONSTRAINT uq_subscription_plans_name UNIQUE (name);

COMMIT;
