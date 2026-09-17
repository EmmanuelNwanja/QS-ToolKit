-- Migration 066: Add 'ready' to classroom_scenes status CHECK constraint
-- 'ready' is written by generateSceneContent, generateCourseLesson, and migration
-- but the CHECK constraint from migration 056 only allows pending|in_progress|completed

ALTER TABLE classroom_scenes
  DROP CONSTRAINT IF EXISTS classroom_scenes_status_check;

ALTER TABLE classroom_scenes
  ADD CONSTRAINT classroom_scenes_status_check
  CHECK (status IN ('pending','in_progress','completed','ready'));
