-- Migration 061: Enhance feature_flags table
-- Adds per-user targeting, environment support

ALTER TABLE feature_flags
  ADD COLUMN IF NOT EXISTS enabled_for_users JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'all' CHECK (environment IN ('all', 'staging', 'production'));

-- Rename rollout_percent to rollout_percentage for clarity (keep old column too)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feature_flags' AND column_name = 'rollout_percent')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feature_flags' AND column_name = 'rollout_percentage') THEN
    ALTER TABLE feature_flags RENAME COLUMN rollout_percent TO rollout_percentage;
  END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_key_env ON feature_flags(feature_key, environment);

-- Update updated_at on row changes
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flags_updated_at ON feature_flags;
CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Seed new flags (with required name column)
INSERT INTO feature_flags (feature_key, name, description, enabled_globally, rollout_percentage) VALUES
  ('classroom', 'Classroom', 'Structured learning with pre-built curriculum', false, 100),
  ('academy', 'QS Academy', 'QS Academy learning pathways', false, 100),
  ('exam_prep', 'Exam Prep', 'Exam preparation tools', false, 100),
  ('parametric_engine', 'Parametric Engine', 'Parametric cost estimation engine', false, 100)
ON CONFLICT (feature_key) DO NOTHING;
