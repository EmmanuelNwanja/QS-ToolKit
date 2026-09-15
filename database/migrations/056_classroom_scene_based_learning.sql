-- Migration 054: Scene-based learning system (classroom module)
-- Creates tables for lessons, scenes, conversation sessions, and outlines.

-- Helper: auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_classroom_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. classroom_lessons - A lesson is a sequence of scenes
CREATE TABLE IF NOT EXISTS classroom_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scene_type_focus TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard','expert')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed')),
  outline JSONB,
  total_scenes INT DEFAULT 0,
  completed_scenes INT DEFAULT 0,
  score DECIMAL(5,2),
  time_spent_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. classroom_scenes - Individual scenes within a lesson
CREATE TABLE IF NOT EXISTS classroom_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES classroom_lessons(id) ON DELETE CASCADE,
  scene_type TEXT NOT NULL CHECK (scene_type IN ('lecture','quiz','boq','rate_analysis','measurement','cost_plan','pbl','discussion')),
  title TEXT NOT NULL,
  order_index INT NOT NULL,
  content JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  score DECIMAL(5,2),
  time_spent_seconds INT DEFAULT 0,
  user_responses JSONB,
  ai_feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. classroom_sessions - Multi-agent conversation sessions
CREATE TABLE IF NOT EXISTS classroom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES classroom_lessons(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES classroom_scenes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  agents JSONB NOT NULL DEFAULT '[]',
  messages JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. classroom_outlines - Generated lesson outlines
CREATE TABLE IF NOT EXISTS classroom_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  target_scene_types TEXT[],
  difficulty TEXT DEFAULT 'medium',
  outline JSONB NOT NULL,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classroom_lessons_user_id ON classroom_lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_scenes_lesson_id ON classroom_scenes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_classroom_scenes_scene_type ON classroom_scenes(scene_type);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_user_id ON classroom_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_lesson_id ON classroom_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_scene_id ON classroom_sessions(scene_id);
CREATE INDEX IF NOT EXISTS idx_classroom_outlines_user_id ON classroom_outlines(user_id);

-- updated_at triggers
CREATE TRIGGER set_classroom_lessons_updated_at
  BEFORE UPDATE ON classroom_lessons
  FOR EACH ROW EXECUTE FUNCTION update_classroom_updated_at();

CREATE TRIGGER set_classroom_sessions_updated_at
  BEFORE UPDATE ON classroom_sessions
  FOR EACH ROW EXECUTE FUNCTION update_classroom_updated_at();

-- Row Level Security
ALTER TABLE classroom_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_outlines ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data

CREATE POLICY "Users can view own lessons"
  ON classroom_lessons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lessons"
  ON classroom_lessons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lessons"
  ON classroom_lessons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lessons"
  ON classroom_lessons FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scenes"
  ON classroom_scenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classroom_lessons
      WHERE classroom_lessons.id = classroom_scenes.lesson_id
      AND classroom_lessons.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own scenes"
  ON classroom_scenes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classroom_lessons
      WHERE classroom_lessons.id = classroom_scenes.lesson_id
      AND classroom_lessons.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own scenes"
  ON classroom_scenes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classroom_lessons
      WHERE classroom_lessons.id = classroom_scenes.lesson_id
      AND classroom_lessons.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own scenes"
  ON classroom_scenes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM classroom_lessons
      WHERE classroom_lessons.id = classroom_scenes.lesson_id
      AND classroom_lessons.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own sessions"
  ON classroom_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON classroom_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON classroom_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON classroom_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own outlines"
  ON classroom_outlines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outlines"
  ON classroom_outlines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outlines"
  ON classroom_outlines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outlines"
  ON classroom_outlines FOR DELETE
  USING (auth.uid() = user_id);
