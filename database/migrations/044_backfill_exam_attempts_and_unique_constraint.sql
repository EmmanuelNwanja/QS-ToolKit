-- Migration 044: Backfill exam_attempts.exam_id + Add unique constraint on exam_questions
-- 1. Backfills exam_attempts.exam_id for existing attempts created before the fix
-- 2. Adds a unique constraint on (exam_id, question_text) so ON CONFLICT DO NOTHING works

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Backfill exam_attempts.exam_id
-- Matches exam_attempts to exam_definitions by exam_name + category
-- ═══════════════════════════════════════════════════════════════

-- Pass 1: Direct exam_name + category match
UPDATE exam_attempts ea
SET exam_id = ed.id
FROM exam_definitions ed
WHERE ea.exam_id IS NULL
  AND ed.is_published = true
  AND LOWER(ed.exam_name) = LOWER(ea.exam_name)
  AND ed.category = ea.exam_category;

-- Pass 2: Fuzzy exam_name match (exam_definitions name contains exam_attempts name or vice versa)
UPDATE exam_attempts ea
SET exam_id = ed.id
FROM exam_definitions ed
WHERE ea.exam_id IS NULL
  AND ed.is_published = true
  AND ed.category = ea.exam_category
  AND (
    LOWER(ed.exam_name) LIKE '%' || LOWER(ea.exam_name) || '%'
    OR LOWER(ea.exam_name) LIKE '%' || LOWER(ed.exam_name) || '%'
  );

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Add unique constraint on exam_questions
-- Makes ON CONFLICT DO NOTHING in migration 041 actually prevent duplicates
-- ═══════════════════════════════════════════════════════════════

-- First, deduplicate any existing questions that would violate the constraint
-- Keep the oldest row (by id) for each (exam_id, question_text) pair
DELETE FROM exam_questions eq1
USING exam_questions eq2
WHERE eq1.id > eq2.id
  AND eq1.exam_id IS NOT NULL
  AND eq2.exam_id IS NOT NULL
  AND eq1.exam_id = eq2.exam_id
  AND eq1.question_text = eq2.question_text;

-- Now add the unique constraint
ALTER TABLE exam_questions
  ADD CONSTRAINT uq_exam_questions_exam_id_text
  UNIQUE (exam_id, question_text);

-- Add index on exam_attempts.exam_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Verification
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  linked_attempts INTEGER;
  unlinked_attempts INTEGER;
  total_questions INTEGER;
  unique_questions INTEGER;
BEGIN
  SELECT COUNT(*) INTO linked_attempts FROM exam_attempts WHERE exam_id IS NOT NULL;
  SELECT COUNT(*) INTO unlinked_attempts FROM exam_attempts WHERE exam_id IS NULL;
  SELECT COUNT(*) INTO total_questions FROM exam_questions;
  SELECT COUNT(*) INTO unique_questions FROM (
    SELECT DISTINCT exam_id, question_text FROM exam_questions WHERE exam_id IS NOT NULL
  ) sub;

  RAISE NOTICE 'Backfill complete: % attempts linked, % still unlinked', linked_attempts, unlinked_attempts;
  RAISE NOTICE 'Constraint check: % total questions, % unique (exam_id, question_text) pairs', total_questions, unique_questions;
END $$;
