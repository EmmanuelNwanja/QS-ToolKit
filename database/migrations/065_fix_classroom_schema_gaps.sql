-- Migration 065: Fix classroom schema gaps
-- Adds missing columns that controllers expect but migrations never created.

-- 1. classroom_scenes: add description, submitted_at, updated_at
ALTER TABLE classroom_scenes
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. classroom_lessons: add archived_at, add 'archived' to status CHECK
ALTER TABLE classroom_lessons
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE classroom_lessons
  DROP CONSTRAINT IF EXISTS classroom_lessons_status_check;

ALTER TABLE classroom_lessons
  ADD CONSTRAINT classroom_lessons_status_check
  CHECK (status IN ('draft','in_progress','completed','active','archived'));

-- 3. classroom_sessions: add message_history, turn_count (code uses these instead of messages)
ALTER TABLE classroom_sessions
  ADD COLUMN IF NOT EXISTS message_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS turn_count INT DEFAULT 0;
