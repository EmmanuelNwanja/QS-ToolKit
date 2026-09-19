-- ============================================================
--  Migration 074: Add study_level and year_of_study to users
--  For student accounts to track academic progress.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS study_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS year_of_study INT;

COMMENT ON COLUMN users.study_level IS 'Student study level: ND, HND, BSc, MSc, PhD';
COMMENT ON COLUMN users.year_of_study IS 'Current year of study (1-6)';
