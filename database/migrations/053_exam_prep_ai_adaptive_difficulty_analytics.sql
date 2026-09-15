-- ============================================================
--  Migration 053: Exam Prep AI — Adaptive Difficulty & Analytics
--  OpenMAIC-inspired adaptive exam engine + analytics dashboard
-- ============================================================

-- ─── 1. ADAPTIVE DIFFICULTY PROFILES ────────────────────────
-- Per-user, per-topic difficulty tracking

CREATE TABLE IF NOT EXISTS exam_difficulty_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  current_level text DEFAULT 'medium'
    CHECK (current_level IN ('easy', 'medium', 'hard')),
  correct_rate decimal(5,4) DEFAULT 0,
  questions_attempted integer DEFAULT 0,
  streak_correct integer DEFAULT 0,
  streak_incorrect integer DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic)
);

CREATE INDEX idx_difficulty_user ON exam_difficulty_profiles(user_id);
CREATE INDEX idx_difficulty_topic ON exam_difficulty_profiles(topic);

-- ─── 2. AI-GENERATED EXAM QUESTIONS ─────────────────────────
-- Dynamically generated questions (not from bank)

CREATE TABLE IF NOT EXISTS exam_ai_generated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category text NOT NULL,
  exam_name text NOT NULL,
  topic text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- questions: [{ question, options: [A,B,C,D], correct, explanation, topic }]
  generation_prompt text,
  model_used text DEFAULT 'gemini-2.0-flash',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_ai_user ON exam_ai_generated(user_id);
CREATE INDEX idx_exam_ai_category ON exam_ai_generated(exam_category);

-- ─── 3. EXAM ANALYTICS ──────────────────────────────────────
-- Aggregated performance data per user per exam

CREATE TABLE IF NOT EXISTS exam_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category text NOT NULL,
  exam_name text NOT NULL,
  total_attempts integer DEFAULT 0,
  avg_score decimal(5,2) DEFAULT 0,
  best_score decimal(5,2) DEFAULT 0,
  avg_time_seconds integer DEFAULT 0,
  topic_breakdown jsonb DEFAULT '{}'::jsonb,
  -- { "Measurement": { correct: 5, total: 8, rate: 0.625 }, "Contracts": { correct: 3, total: 6, rate: 0.5 } }
  weakness_areas text[] DEFAULT '{}',
  pass_probability decimal(5,4) DEFAULT 0,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, exam_category, exam_name)
);

CREATE INDEX idx_analytics_user ON exam_analytics(user_id);

-- ─── 4. UPDATED_AT TRIGGERS ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_exam_ai_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exam_difficulty_profiles_updated ON exam_difficulty_profiles;
CREATE TRIGGER exam_difficulty_profiles_updated
  BEFORE UPDATE ON exam_difficulty_profiles
  FOR EACH ROW EXECUTE FUNCTION update_exam_ai_timestamp();

DROP TRIGGER IF EXISTS exam_analytics_updated ON exam_analytics;
CREATE TRIGGER exam_analytics_updated
  BEFORE UPDATE ON exam_analytics
  FOR EACH ROW EXECUTE FUNCTION update_exam_ai_timestamp();

-- ─── 5. RLS POLICIES ────────────────────────────────────────

ALTER TABLE exam_difficulty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_ai_generated ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "difficulty_profiles_own" ON exam_difficulty_profiles FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "exam_ai_generated_own" ON exam_ai_generated FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "exam_analytics_own" ON exam_analytics FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
