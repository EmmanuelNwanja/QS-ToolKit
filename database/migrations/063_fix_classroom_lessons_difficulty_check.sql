-- Migration 063: Fix classroom_lessons difficulty check constraint
-- Original only allowed easy|medium|hard|expert but curriculum uses beginner|intermediate|advanced

ALTER TABLE classroom_lessons
  DROP CONSTRAINT IF EXISTS classroom_lessons_difficulty_check;

ALTER TABLE classroom_lessons
  ADD CONSTRAINT classroom_lessons_difficulty_check
  CHECK (difficulty IN ('easy','medium','hard','expert','beginner','intermediate','advanced'));
