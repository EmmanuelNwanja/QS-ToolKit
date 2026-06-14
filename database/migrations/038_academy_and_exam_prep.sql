-- ============================================================
--  Migration 038: QS Academy & QS Exam Prep
--  Academy growth pathways, contests, tokens, exam bank & trials
-- ============================================================

-- ─── 1. ACADEMY SUBSCRIPTIONS ─────────────────────────────────
-- Weekly academy add-on subscriptions (one active per user)

CREATE TABLE IF NOT EXISTS academy_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paystack_reference text,
  amount_paid decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_academy_sub_user ON academy_subscriptions(user_id);
CREATE INDEX idx_academy_sub_status ON academy_subscriptions(status);
CREATE UNIQUE INDEX idx_academy_sub_active_one_per_user ON academy_subscriptions(user_id) WHERE status = 'active';

-- ─── 2. EXAM PREP SUBSCRIPTIONS ───────────────────────────────
-- Weekly exam prep add-on subscriptions (one active per user)

CREATE TABLE IF NOT EXISTS exam_prep_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paystack_reference text,
  amount_paid decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_prep_sub_user ON exam_prep_subscriptions(user_id);
CREATE INDEX idx_exam_prep_sub_status ON exam_prep_subscriptions(status);
CREATE UNIQUE INDEX idx_exam_prep_sub_active_one_per_user ON exam_prep_subscriptions(user_id) WHERE status = 'active';

-- ─── 3. ACADEMY PROFILES ──────────────────────────────────────
-- User strengths/weaknesses declaration + admission results

CREATE TABLE IF NOT EXISTS academy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strengths text[] DEFAULT '{}',
  weaknesses text[] DEFAULT '{}',
  recommended_pathway text,
  admission_score integer,
  admission_completed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_academy_profile_user ON academy_profiles(user_id);

-- ─── 4. ACADEMY ADMISSION TESTS ──────────────────────────────
-- Generated admission test per user

CREATE TABLE IF NOT EXISTS academy_admission_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb DEFAULT '{}'::jsonb,
  score integer,
  time_limit_seconds integer DEFAULT 900,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admission_test_user ON academy_admission_tests(user_id);
CREATE INDEX idx_admission_test_status ON academy_admission_tests(status);

-- ─── 5. ACADEMY PATHWAYS ─────────────────────────────────────
-- Defines the 7 growth pathways

CREATE TABLE IF NOT EXISTS academy_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  focus_area text NOT NULL,
  levels jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pathway_slug ON academy_pathways(slug);
CREATE INDEX idx_pathway_active ON academy_pathways(is_active);

-- ─── 6. ACADEMY PATHWAY PROGRESS ─────────────────────────────
-- Tracks user progress within a pathway

CREATE TABLE IF NOT EXISTS academy_pathway_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  current_level integer DEFAULT 1,
  completion_pct decimal(5,2) DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_pathway_prog_user_pathway ON academy_pathway_progress(user_id, pathway_id);
CREATE INDEX idx_pathway_prog_user ON academy_pathway_progress(user_id);
CREATE INDEX idx_pathway_prog_pathway ON academy_pathway_progress(pathway_id);

-- ─── 7. ACADEMY RESOURCES ─────────────────────────────────────
-- Resource library content (articles, quizzes, case studies, videos)

CREATE TABLE IF NOT EXISTS academy_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid REFERENCES academy_pathways(id) ON DELETE SET NULL,
  category text NOT NULL,
  level integer,
  title text NOT NULL,
  content text,
  resource_type text NOT NULL CHECK (resource_type IN ('article', 'quiz', 'case_study', 'video')),
  tags text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_pathway ON academy_resources(pathway_id);
CREATE INDEX idx_resource_category ON academy_resources(category);
CREATE INDEX idx_resource_type ON academy_resources(resource_type);
CREATE INDEX idx_resource_published ON academy_resources(is_published) WHERE is_published = true;

-- ─── 8. ACADEMY CONTESTS ──────────────────────────────────────
-- Knowledge arena contest definitions

CREATE TABLE IF NOT EXISTS academy_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contest_type text NOT NULL CHECK (contest_type IN ('duel', 'group', 'dr_q', 'scheduled')),
  topic text NOT NULL,
  question_count integer DEFAULT 10,
  time_limit_seconds integer DEFAULT 600,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  scheduled_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  questions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contest_creator ON academy_contests(creator_id);
CREATE INDEX idx_contest_type ON academy_contests(contest_type);
CREATE INDEX idx_contest_status ON academy_contests(status);
CREATE INDEX idx_contest_scheduled ON academy_contests(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ─── 9. ACADEMY CONTEST PARTICIPANTS ──────────────────────────
-- User participation in contests

CREATE TABLE IF NOT EXISTS academy_contest_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES academy_contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score integer DEFAULT 0,
  tokens_earned integer DEFAULT 0,
  answers jsonb DEFAULT '{}'::jsonb,
  joined_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  lateness_minutes integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contest_participant_unique ON academy_contest_participants(contest_id, user_id);
CREATE INDEX idx_contest_participant_user ON academy_contest_participants(user_id);
CREATE INDEX idx_contest_participant_contest ON academy_contest_participants(contest_id);

-- ─── 10. ACADEMY TOKENS ───────────────────────────────────────
-- Token ledger (earnings from contests, daily bonuses, achievements)

CREATE TABLE IF NOT EXISTS academy_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL CHECK (source IN ('contest', 'daily_bonus', 'achievement', 'referral', 'admin_adjustment')),
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_user ON academy_tokens(user_id);
CREATE INDEX idx_token_source ON academy_tokens(source);
CREATE INDEX idx_token_created ON academy_tokens(created_at DESC);

-- ─── 11. EXAM QUESTIONS ───────────────────────────────────────
-- Question bank for all exam types

CREATE TABLE IF NOT EXISTS exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_category text NOT NULL CHECK (exam_category IN ('nigerian_professional', 'international', 'university')),
  exam_name text NOT NULL,
  topic text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'short_answer', 'calculation', 'true_false', 'scenario')),
  options jsonb,
  correct_answer text NOT NULL,
  explanation text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  year integer,
  university text,
  course_code text,
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eq_category ON exam_questions(exam_category);
CREATE INDEX idx_eq_exam_name ON exam_questions(exam_name);
CREATE INDEX idx_eq_topic ON exam_questions(topic);
CREATE INDEX idx_eq_difficulty ON exam_questions(difficulty);
CREATE INDEX idx_eq_active ON exam_questions(is_active) WHERE is_active = true;
CREATE INDEX idx_eq_tags ON exam_questions USING gin(tags);

-- ─── 12. EXAM ATTEMPTS ────────────────────────────────────────
-- Tracks exam attempts

CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category text NOT NULL,
  exam_name text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb DEFAULT '{}'::jsonb,
  score integer,
  total_questions integer NOT NULL,
  time_limit_seconds integer NOT NULL,
  timed boolean DEFAULT true,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned')),
  is_trial boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_attempt_user ON exam_attempts(user_id);
CREATE INDEX idx_exam_attempt_category ON exam_attempts(exam_category);
CREATE INDEX idx_exam_attempt_exam_name ON exam_attempts(exam_name);
CREATE INDEX idx_exam_attempt_status ON exam_attempts(status);

-- ─── 13. EXAM TRIALS ──────────────────────────────────────────
-- Tracks free trial usage (one per user)

CREATE TABLE IF NOT EXISTS exam_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category text NOT NULL,
  exam_name text NOT NULL,
  attempt_id uuid REFERENCES exam_attempts(id) ON DELETE SET NULL,
  used_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_exam_trial_user ON exam_trials(user_id);
CREATE INDEX idx_exam_trial_category ON exam_trials(exam_category);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_academy_profile_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academy_profiles_updated_at ON academy_profiles;
CREATE TRIGGER academy_profiles_updated_at
  BEFORE UPDATE ON academy_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_academy_profile_timestamp();

CREATE OR REPLACE FUNCTION update_pathway_progress_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academy_pathway_progress_updated_at ON academy_pathway_progress;
CREATE TRIGGER academy_pathway_progress_updated_at
  BEFORE UPDATE ON academy_pathway_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_pathway_progress_timestamp();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE academy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_prep_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_admission_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_pathway_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_contest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_trials ENABLE ROW LEVEL SECURITY;

-- academy_subscriptions: users see/modify their own subscriptions
CREATE POLICY "academy_subscriptions_own" ON academy_subscriptions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- exam_prep_subscriptions: users see/modify their own subscriptions
CREATE POLICY "exam_prep_subscriptions_own" ON exam_prep_subscriptions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- academy_profiles: users manage their own profile
CREATE POLICY "academy_profiles_own" ON academy_profiles
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- academy_admission_tests: users manage their own tests
CREATE POLICY "academy_admission_tests_own" ON academy_admission_tests
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- academy_pathways: all authenticated users can read active pathways
CREATE POLICY "academy_pathways_read" ON academy_pathways
  FOR SELECT USING (is_active = true);

-- academy_pathway_progress: users see/modify their own progress
CREATE POLICY "academy_pathway_progress_own" ON academy_pathway_progress
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- academy_resources: all authenticated users can read published resources
CREATE POLICY "academy_resources_read" ON academy_resources
  FOR SELECT USING (is_published = true);

-- academy_contests: users see all contests, only manage their own
CREATE POLICY "academy_contests_read" ON academy_contests
  FOR SELECT USING (true);

CREATE POLICY "academy_contests_manage_own" ON academy_contests
  FOR INSERT WITH CHECK (creator_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "academy_contests_update_own" ON academy_contests
  FOR UPDATE USING (creator_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "academy_contests_delete_own" ON academy_contests
  FOR DELETE USING (creator_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- academy_contest_participants: users manage their own participation
CREATE POLICY "academy_contest_participants_own" ON academy_contest_participants
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- academy_tokens: users see their own token history
CREATE POLICY "academy_tokens_own" ON academy_tokens
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- exam_questions: all authenticated users can read active questions
CREATE POLICY "exam_questions_read" ON exam_questions
  FOR SELECT USING (is_active = true);

-- exam_attempts: users manage their own attempts
CREATE POLICY "exam_attempts_own" ON exam_attempts
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- exam_trials: users see/modify their own trial
CREATE POLICY "exam_trials_own" ON exam_trials
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- ─── TABLE COMMENTS ───────────────────────────────────────────

COMMENT ON TABLE academy_subscriptions IS 'Weekly academy add-on subscriptions — one active subscription per user at a time';
COMMENT ON TABLE exam_prep_subscriptions IS 'Weekly exam prep add-on subscriptions — one active subscription per user at a time';
COMMENT ON TABLE academy_profiles IS 'User strengths/weaknesses declaration and admission test results for personalized pathway recommendation';
COMMENT ON TABLE academy_admission_tests IS 'Generated admission tests for new academy users — timed with status tracking';
COMMENT ON TABLE academy_pathways IS 'Defines the 7 QS growth pathways with levels, competencies, and outcomes';
COMMENT ON TABLE academy_pathway_progress IS 'Tracks each user progress within a pathway including current level and completion percentage';
COMMENT ON TABLE academy_resources IS 'Resource library content: articles, quizzes, case studies, and videos organized by pathway and level';
COMMENT ON TABLE academy_contests IS 'Knowledge arena contest definitions including duels, group contests, Dr Q, and scheduled events';
COMMENT ON TABLE academy_contest_participants IS 'User participation records for contests with scores, tokens earned, and completion timing';
COMMENT ON TABLE academy_tokens IS 'Token ledger tracking earnings from contests, daily bonuses, achievements, and referrals';
COMMENT ON TABLE exam_questions IS 'Question bank for Nigerian professional, international, and university-level QS exams';
COMMENT ON TABLE exam_attempts IS 'Tracks all exam attempts including timed scores, status, and trial flags';
COMMENT ON TABLE exam_trials IS 'Tracks free trial usage — one trial per user across the platform';
