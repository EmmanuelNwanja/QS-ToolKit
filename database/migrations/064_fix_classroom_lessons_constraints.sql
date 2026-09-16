-- Migration 064: Fix classroom_lessons difficulty + status check constraints
-- difficulty: add beginner|intermediate|advanced
-- status: add active

ALTER TABLE classroom_lessons
  DROP CONSTRAINT IF EXISTS classroom_lessons_difficulty_check,
  DROP CONSTRAINT IF EXISTS classroom_lessons_status_check;

ALTER TABLE classroom_lessons
  ADD CONSTRAINT classroom_lessons_difficulty_check
  CHECK (difficulty IN ('easy','medium','hard','expert','beginner','intermediate','advanced'));

ALTER TABLE classroom_lessons
  ADD CONSTRAINT classroom_lessons_status_check
  CHECK (status IN ('draft','in_progress','completed','active'));
