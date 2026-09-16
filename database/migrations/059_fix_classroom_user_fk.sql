-- Migration 059: Fix classroom_user_progress foreign key
-- The original 058 referenced auth.users(id) but the app uses a custom users table.

DO $$
BEGIN
  -- Drop the wrong FK if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_user_progress_user_id_fkey'
    AND conrelid = 'classroom_user_progress'::regclass
  ) THEN
    ALTER TABLE classroom_user_progress
      DROP CONSTRAINT classroom_user_progress_user_id_fkey;
  END IF;

  -- Re-add with correct reference
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_user_progress_user_id_fkey'
    AND conrelid = 'classroom_user_progress'::regclass
  ) THEN
    ALTER TABLE classroom_user_progress
      ADD CONSTRAINT classroom_user_progress_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
