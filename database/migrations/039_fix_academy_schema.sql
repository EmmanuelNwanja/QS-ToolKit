-- ============================================================
--  Migration 039: Fix Academy & Exam Prep schema mismatches
--  Adds missing columns and tables referenced by controllers
-- ============================================================

-- ─── 1. ACADEMY PROFILES: add goals column ────────────────────
ALTER TABLE academy_profiles
  ADD COLUMN IF NOT EXISTS goals text[] DEFAULT '{}';

-- ─── 2. ACADEMY ADMISSION TESTS: add missing columns ──────────
ALTER TABLE academy_admission_tests
  ADD COLUMN IF NOT EXISTS passed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- ─── 3. ACADEMY PATHWAYS: add missing columns ─────────────────
ALTER TABLE academy_pathways
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS module_count integer DEFAULT 0;

-- Backfill is_published from is_active
UPDATE academy_pathways SET is_published = is_active WHERE is_published IS DISTINCT FROM is_active;

-- ─── 4. ACADEMY CONTESTS: add missing columns ─────────────────
ALTER TABLE academy_contests
  ADD COLUMN IF NOT EXISTS title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_participants integer;

-- Backfill title from topic
UPDATE academy_contests SET title = topic WHERE title = '' OR title IS NULL;

-- ─── 5. ACADEMY RESOURCES: add pathway_slug column ────────────
ALTER TABLE academy_resources
  ADD COLUMN IF NOT EXISTS pathway_slug text;

-- Backfill pathway_slug from academy_pathways
UPDATE academy_resources r
  SET pathway_slug = p.slug
  FROM academy_pathways p
  WHERE r.pathway_id = p.id AND r.pathway_slug IS NULL;

-- ─── 6. ACADEMY TOKENS: rename source to source_type, add desc ─
ALTER TABLE academy_tokens
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Backfill source_type from source
UPDATE academy_tokens SET source_type = source WHERE source_type IS NULL;

-- ─── 7. CREATE MISSING TABLES ─────────────────────────────────

-- Academy enrollments (replaces academy_pathway_progress for enrollment tracking)
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_enrollment_unique ON academy_enrollments(user_id, pathway_id);
CREATE INDEX idx_enrollment_user ON academy_enrollments(user_id);

-- Academy module progress
CREATE TABLE IF NOT EXISTS academy_module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  module_id uuid,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mod_prog_user ON academy_module_progress(user_id);
CREATE INDEX idx_mod_prog_pathway ON academy_module_progress(pathway_id);
CREATE UNIQUE INDEX idx_mod_prog_user_module ON academy_module_progress(user_id, module_id) WHERE module_id IS NOT NULL;

-- Academy contest questions (for structured contest question storage)
CREATE TABLE IF NOT EXISTS academy_contest_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES academy_contests(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'mcq',
  options jsonb,
  correct_answer text NOT NULL,
  explanation text,
  difficulty text DEFAULT 'medium',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contest_q_contest ON academy_contest_questions(contest_id);

-- Academy contest submissions (detailed scoring per user per contest)
CREATE TABLE IF NOT EXISTS academy_contest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES academy_contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES academy_contest_participants(id) ON DELETE SET NULL,
  answers jsonb DEFAULT '[]'::jsonb,
  total_points integer DEFAULT 0,
  time_bonus integer DEFAULT 0,
  time_spent_minutes integer DEFAULT 0,
  detailed_results jsonb DEFAULT '[]'::jsonb,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contest_sub_unique ON academy_contest_submissions(contest_id, user_id);
CREATE INDEX idx_contest_sub_user ON academy_contest_submissions(user_id);

-- Academy resource views (analytics)
CREATE TABLE IF NOT EXISTS academy_resource_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES academy_resources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_res_view_resource ON academy_resource_views(resource_id);
CREATE INDEX idx_res_view_user ON academy_resource_views(user_id);

-- ─── 8. RLS POLICIES FOR NEW TABLES ───────────────────────────

ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_contest_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_contest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_resource_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'enrollments_own' AND tablename = 'academy_enrollments') THEN
    CREATE POLICY enrollments_own ON academy_enrollments FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'module_progress_own' AND tablename = 'academy_module_progress') THEN
    CREATE POLICY module_progress_own ON academy_module_progress FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contest_questions_public' AND tablename = 'academy_contest_questions') THEN
    CREATE POLICY contest_questions_public ON academy_contest_questions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contest_submissions_own' AND tablename = 'academy_contest_submissions') THEN
    CREATE POLICY contest_submissions_own ON academy_contest_submissions FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resource_views_own' AND tablename = 'academy_resource_views') THEN
    CREATE POLICY resource_views_own ON academy_resource_views FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
  END IF;
END $$;

-- ─── 9. EXAM DEFINITIONS (master table for all exam types) ─────
CREATE TABLE IF NOT EXISTS exam_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('nigerian_professional', 'international', 'university')),
  description text DEFAULT '',
  time_limit_minutes integer DEFAULT 60,
  total_questions integer DEFAULT 0,
  passing_score integer DEFAULT 50,
  is_published boolean DEFAULT true,
  is_past_question boolean DEFAULT false,
  university_id uuid,
  course_id uuid,
  year integer,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_def_category ON exam_definitions(category);
CREATE INDEX idx_exam_def_published ON exam_definitions(is_published) WHERE is_published = true;
CREATE INDEX idx_exam_def_past ON exam_definitions(is_past_question) WHERE is_past_question = true;

-- ─── 10. EXAM UNIVERSITIES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uni_active ON exam_universities(is_active) WHERE is_active = true;

-- ─── 11. EXAM COURSES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES exam_universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  level text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_university ON exam_courses(university_id);
CREATE INDEX idx_course_active ON exam_courses(is_active) WHERE is_active = true;

-- Link exam_definitions to universities/courses
ALTER TABLE exam_definitions
  ADD CONSTRAINT fk_exam_def_university
  FOREIGN KEY (university_id) REFERENCES exam_universities(id) ON DELETE SET NULL;

ALTER TABLE exam_definitions
  ADD CONSTRAINT fk_exam_def_course
  FOREIGN KEY (course_id) REFERENCES exam_courses(id) ON DELETE SET NULL;

-- Link exam_attempts to exam_definitions
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES exam_definitions(id) ON DELETE SET NULL;

-- Link exam_trials to exam_definitions
ALTER TABLE exam_trials
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES exam_definitions(id) ON DELETE SET NULL;

-- Add exam_id to exam_questions for linking
ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES exam_definitions(id) ON DELETE SET NULL;

-- Add missing columns to exam_attempts for scoring
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS earned_marks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_marks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percentage integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS detailed_results jsonb DEFAULT '[]'::jsonb;

-- Add marks to exam_questions
ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS marks integer DEFAULT 1;

-- RLS for new exam tables
ALTER TABLE exam_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_courses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'exam_def_public' AND tablename = 'exam_definitions') THEN
    CREATE POLICY exam_def_public ON exam_definitions FOR SELECT USING (is_published = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'exam_def_admin' AND tablename = 'exam_definitions') THEN
    CREATE POLICY exam_def_admin ON exam_definitions FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'uni_public' AND tablename = 'exam_universities') THEN
    CREATE POLICY uni_public ON exam_universities FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'uni_admin' AND tablename = 'exam_universities') THEN
    CREATE POLICY uni_admin ON exam_universities FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'course_public' AND tablename = 'exam_courses') THEN
    CREATE POLICY course_public ON exam_courses FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'course_admin' AND tablename = 'exam_courses') THEN
    CREATE POLICY course_admin ON exam_courses FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
    );
  END IF;
END $$;
