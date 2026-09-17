-- Migration 067: Hard-delete orphaned lessons with 0 scenes
-- These were created during the 'ready' CHECK constraint bug.
-- Each had total_scenes > 0 but 0 actual scene rows due to batch insert rollback.

DELETE FROM classroom_lessons
WHERE total_scenes > 0
AND NOT EXISTS (
  SELECT 1 FROM classroom_scenes WHERE classroom_scenes.lesson_id = classroom_lessons.id
);
