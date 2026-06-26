-- 045: Fix academy and exam prep schema issues
-- Fixes:
--   1. academy_contests: add 'scheduled' to status CHECK constraint
--   2. academy_subscriptions: add billing_cycle column
--   3. exam_prep_subscriptions: add billing_cycle column
--   4. exam_questions: add index on exam_id for query performance

-- ───────────────────────────────────────────────────────────────
-- 1. Fix academy_contests status CHECK constraint
-- ───────────────────────────────────────────────────────────────

-- Drop the old constraint that only allows pending/active/completed/cancelled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%academy_contests%status%'
      AND conrelid = 'academy_contests'::regclass
  ) THEN
    ALTER TABLE academy_contests
      DROP CONSTRAINT academy_contests_status_check;
  END IF;
END $$;

-- Re-create with 'scheduled' added
ALTER TABLE academy_contests
  ADD CONSTRAINT academy_contests_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'scheduled'));

-- ───────────────────────────────────────────────────────────────
-- 2. Add billing_cycle to academy_subscriptions
-- ───────────────────────────────────────────────────────────────

ALTER TABLE academy_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'weekly';

-- Backfill from direct_payment_submissions where possible
UPDATE academy_subscriptions sub
SET billing_cycle = COALESCE(
  (SELECT dps.billing_interval
   FROM direct_payment_submissions dps
   WHERE dps.user_id = sub.user_id
     AND dps.plan_name LIKE 'academy%'
     AND dps.status = 'verified'
   ORDER BY dps.created_at DESC
   LIMIT 1),
  sub.billing_cycle
)
WHERE sub.billing_cycle = 'weekly';

-- ───────────────────────────────────────────────────────────────
-- 3. Add billing_cycle to exam_prep_subscriptions
-- ───────────────────────────────────────────────────────────────

ALTER TABLE exam_prep_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'weekly';

-- Backfill from direct_payment_submissions where possible
UPDATE exam_prep_subscriptions sub
SET billing_cycle = COALESCE(
  (SELECT dps.billing_interval
   FROM direct_payment_submissions dps
   WHERE dps.user_id = sub.user_id
     AND dps.plan_name LIKE 'exam_prep%'
     AND dps.status = 'verified'
   ORDER BY dps.created_at DESC
   LIMIT 1),
  sub.billing_cycle
)
WHERE sub.billing_cycle = 'weekly';

-- ───────────────────────────────────────────────────────────────
-- 4. Add index on exam_questions.exam_id for query performance
-- ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id
  ON exam_questions(exam_id);

-- Also add index on exam_questions.is_active for filtered queries
CREATE INDEX IF NOT EXISTS idx_exam_questions_is_active
  ON exam_questions(is_active) WHERE is_active = true;

-- ───────────────────────────────────────────────────────────────
-- 5. Add index on academy_contest_questions.contest_id
-- ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_academy_contest_questions_contest_id
  ON academy_contest_questions(contest_id);
