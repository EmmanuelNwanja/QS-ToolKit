-- Migration 049: Add non-MCQ question types for exams
-- Adds long_answer, essay, mock_interview to exam_questions CHECK constraint
-- Adds AI scoring fields for text-based answers

BEGIN;

-- 1. Drop old CHECK constraint and add expanded one
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_type_check;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_type_check
  CHECK (question_type IN ('mcq', 'short_answer', 'calculation', 'true_false', 'scenario', 'long_answer', 'essay', 'mock_interview'));

-- 2. Add AI scoring columns for text-based answers
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS sample_answer text;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS scoring_rubric text;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS max_words integer;

-- 3. Add AI assessment columns to exam_attempts (for text-based scoring)
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS ai_assessment jsonb;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS ai_score_breakdown jsonb;

-- 4. Index for question_type filtering
CREATE INDEX IF NOT EXISTS idx_exam_questions_question_type ON exam_questions(question_type) WHERE is_active = true;

COMMIT;
