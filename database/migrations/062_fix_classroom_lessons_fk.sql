-- Migration 062: Fix classroom_lessons and classroom_scenes FK constraints
-- Both reference auth.users(id) but the app uses a custom users table.

DO $$
BEGIN
  -- Fix classroom_lessons.user_id FK
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_lessons_user_id_fkey'
    AND conrelid = 'classroom_lessons'::regclass
  ) THEN
    ALTER TABLE classroom_lessons
      DROP CONSTRAINT classroom_lessons_user_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_lessons_user_id_fkey'
    AND conrelid = 'classroom_lessons'::regclass
  ) THEN
    ALTER TABLE classroom_lessons
      ADD CONSTRAINT classroom_lessons_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Fix classroom_scenes if it has a bad FK (no FK on lesson_id is fine, but check user_id if present)
  -- classroom_scenes references classroom_lessons(id) which is fine
END $$;
