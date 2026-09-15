-- ============================================================
--  Migration 052: Academy AI Lessons, Simulations & Whiteboard
--  OpenMAIC-inspired interactive content for QS Academy
-- ============================================================

-- ─── 1. ACADEMY LESSONS ─────────────────────────────────────
-- AI-generated or curated lesson content per pathway module

CREATE TABLE IF NOT EXISTS academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- content: { objectives: [], sections: [{heading, body, examples[]}], practice_questions: [{question, options[], correct, explanation}], takeaways: [] }
  lesson_type text NOT NULL DEFAULT 'ai_generated'
    CHECK (lesson_type IN ('ai_generated', 'curated', 'video', 'interactive')),
  difficulty text DEFAULT 'intermediate'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_minutes integer DEFAULT 15,
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_pathway ON academy_lessons(pathway_id);
CREATE INDEX idx_lesson_module ON academy_lessons(module_id);

-- ─── 2. LESSON PROGRESS ─────────────────────────────────────
-- Per-user lesson completion tracking

CREATE TABLE IF NOT EXISTS academy_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completion_pct decimal(5,2) DEFAULT 0,
  time_spent_seconds integer DEFAULT 0,
  quiz_score decimal(5,2),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user ON academy_lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON academy_lesson_progress(lesson_id);

-- ─── 3. ACADEMY SIMULATIONS ─────────────────────────────────
-- Interactive QS scenarios: BOQ, rate analysis, measurement, cost planning

CREATE TABLE IF NOT EXISTS academy_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  simulation_type text NOT NULL
    CHECK (simulation_type IN ('boq_scenario', 'rate_analysis', 'measurement_takeoff', 'cost_plan')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- boq_scenario: { project_type, rooms[], budget_range, difficulty, items: [{name, unit, qty, rate}] }
  -- rate_analysis: { item_description, unit, historical_rates[], region, factors[] }
  -- measurement_takeoff: { elements: [{name, dimension, unit}], standard }
  -- cost_plan: { building_type, area_m2, location, specifications, breakdown: [{category, pct}] }
  difficulty text DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_minutes integer DEFAULT 20,
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulation_pathway ON academy_simulations(pathway_id);
CREATE INDEX idx_simulation_type ON academy_simulations(simulation_type);

-- ─── 4. SIMULATION ATTEMPTS ─────────────────────────────────
-- User attempts at simulations

CREATE TABLE IF NOT EXISTS academy_simulation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  simulation_id uuid NOT NULL REFERENCES academy_simulations(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- answers: { items: [{id, user_qty, user_rate, correct}], decisions: [{step, choice, correct}] }
  score decimal(5,2) DEFAULT 0,
  max_score decimal(5,2) DEFAULT 0,
  time_spent_seconds integer DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sim_attempt_user ON academy_simulation_attempts(user_id);
CREATE INDEX idx_sim_attempt_sim ON academy_simulation_attempts(simulation_id);

-- ─── 5. WHITEBOARD ──────────────────────────────────────────
-- User annotations on lesson/simulation content

CREATE TABLE IF NOT EXISTS academy_whiteboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES academy_lessons(id) ON DELETE SET NULL,
  simulation_id uuid REFERENCES academy_simulations(id) ON DELETE SET NULL,
  title text DEFAULT 'Untitled',
  drawing_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- drawing_data: [{ type: 'rect'|'circle'|'line'|'text'|'freehand', x, y, width, height, text, color, points[] }]
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whiteboard_user ON academy_whiteboard(user_id);
CREATE INDEX idx_whiteboard_lesson ON academy_whiteboard(lesson_id);

-- ─── 6. UPDATED_AT TRIGGERS ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_academy_content_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academy_lessons_updated ON academy_lessons;
CREATE TRIGGER academy_lessons_updated
  BEFORE UPDATE ON academy_lessons
  FOR EACH ROW EXECUTE FUNCTION update_academy_content_timestamp();

DROP TRIGGER IF EXISTS academy_simulations_updated ON academy_simulations;
CREATE TRIGGER academy_simulations_updated
  BEFORE UPDATE ON academy_simulations
  FOR EACH ROW EXECUTE FUNCTION update_academy_content_timestamp();

DROP TRIGGER IF EXISTS academy_whiteboard_updated ON academy_whiteboard;
CREATE TRIGGER academy_whiteboard_updated
  BEFORE UPDATE ON academy_whiteboard
  FOR EACH ROW EXECUTE FUNCTION update_academy_content_timestamp();

-- ─── 7. RLS POLICIES ────────────────────────────────────────

ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_simulation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_whiteboard ENABLE ROW LEVEL SECURITY;

-- Published lessons/simulations readable by all authenticated users
CREATE POLICY "academy_lessons_read" ON academy_lessons
  FOR SELECT USING (is_published = true);

CREATE POLICY "academy_simulations_read" ON academy_simulations
  FOR SELECT USING (is_published = true);

-- Own progress/whiteboard data
CREATE POLICY "lesson_progress_own" ON academy_lesson_progress FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "sim_attempts_own" ON academy_simulation_attempts FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "whiteboard_own" ON academy_whiteboard FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
