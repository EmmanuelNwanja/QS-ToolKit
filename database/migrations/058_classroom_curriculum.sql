-- Migration 058: Classroom curriculum — structured courses + user progress
-- Adds course catalog, user advancement tracking, and links lessons to courses.

-- 1. classroom_courses — the curriculum catalog
CREATE TABLE IF NOT EXISTS classroom_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📚',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  difficulty_config JSONB NOT NULL DEFAULT '{
    "beginner": { "scene_types": ["lecture","quiz"], "scene_count": 5 },
    "intermediate": { "scene_types": ["lecture","quiz","boq"], "scene_count": 6 },
    "advanced": { "scene_types": ["boq","rate_analysis","pbl"], "scene_count": 7 }
  }',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. classroom_user_progress — per-user, per-course advancement
CREATE TABLE IF NOT EXISTS classroom_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
  current_level TEXT DEFAULT 'beginner' CHECK (current_level IN ('beginner','intermediate','advanced')),
  completed_lessons INT DEFAULT 0,
  total_score DECIMAL(5,2) DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- 3. Add course_id and level to classroom_lessons (nullable = custom lesson)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classroom_lessons' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE classroom_lessons ADD COLUMN course_id UUID REFERENCES classroom_courses(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classroom_lessons' AND column_name = 'level'
  ) THEN
    ALTER TABLE classroom_lessons ADD COLUMN level TEXT CHECK (level IN ('beginner','intermediate','advanced'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classroom_courses_slug ON classroom_courses(slug);
CREATE INDEX IF NOT EXISTS idx_classroom_courses_active ON classroom_courses(is_active);
CREATE INDEX IF NOT EXISTS idx_classroom_user_progress_user_id ON classroom_user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_user_progress_course_id ON classroom_user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_classroom_user_progress_user_course ON classroom_user_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_classroom_lessons_course_id ON classroom_lessons(course_id);

-- updated_at trigger for user_progress
CREATE TRIGGER set_classroom_user_progress_updated_at
  BEFORE UPDATE ON classroom_user_progress
  FOR EACH ROW EXECUTE FUNCTION update_classroom_updated_at();

-- Row Level Security
ALTER TABLE classroom_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_user_progress ENABLE ROW LEVEL SECURITY;

-- Courses are public read (everyone can see the catalog)
CREATE POLICY "Anyone can view active courses"
  ON classroom_courses FOR SELECT
  USING (is_active = TRUE);

-- User progress: users can only access their own
CREATE POLICY "Users can view own progress"
  ON classroom_user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON classroom_user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON classroom_user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── Seed 8 courses ────────────────────────────────────────────

INSERT INTO classroom_courses (title, slug, description, icon, sort_order, difficulty_config) VALUES
(
  'Measurement Fundamentals',
  'measurement-fundamentals',
  'Master building measurement and quantity takeoff using NRM2 rules. From basic dimensions to complex element measurement.',
  '📏',
  1,
  '{
    "beginner": { "scene_types": ["lecture","quiz","measurement"], "scene_count": 5, "topic_hint": "basic building measurement, dimensions, NRM2 rules" },
    "intermediate": { "scene_types": ["measurement","boq","quiz"], "scene_count": 6, "topic_hint": "complex element measurement, multi-storey buildings" },
    "advanced": { "scene_types": ["measurement","boq","rate_analysis"], "scene_count": 7, "topic_hint": "detailed measurement for remeasurement, variation orders" }
  }'
),
(
  'BOQ Preparation',
  'boq-preparation',
  'Learn to prepare complete Bills of Quantities following SMM7 format. From substructure to finishes.',
  '📊',
  2,
  '{
    "beginner": { "scene_types": ["lecture","quiz","boq"], "scene_count": 5, "topic_hint": "BOQ structure, SMM7 format, basic line items" },
    "intermediate": { "scene_types": ["boq","rate_analysis","quiz"], "scene_count": 6, "topic_hint": "complete BOQ compilation, rate application" },
    "advanced": { "scene_types": ["boq","cost_plan","pbl"], "scene_count": 7, "topic_hint": "BOQ for complex projects, provisional sums, daywork" }
  }'
),
(
  'Rate Analysis',
  'rate-analysis',
  'Break down construction rates into materials, labor, plant, and overheads. Nigerian market rates in ₦.',
  '💰',
  3,
  '{
    "beginner": { "scene_types": ["lecture","quiz","rate_analysis"], "scene_count": 5, "topic_hint": "rate components, material costing, labor rates" },
    "intermediate": { "scene_types": ["rate_analysis","cost_plan","boq"], "scene_count": 6, "topic_hint": "complex rate build-ups, subcontractor rates" },
    "advanced": { "scene_types": ["rate_analysis","pbl","discussion"], "scene_count": 7, "topic_hint": "rate disputes, market variations, inflation adjustments" }
  }'
),
(
  'Cost Planning',
  'cost-planning',
  'Elemental cost planning, budgeting, and cost estimation for Nigerian construction projects.',
  '🧮',
  4,
  '{
    "beginner": { "scene_types": ["lecture","quiz","cost_plan"], "scene_count": 5, "topic_hint": "cost plan structure, elemental analysis, percentages" },
    "intermediate": { "scene_types": ["cost_plan","boq","rate_analysis"], "scene_count": 6, "topic_hint": "detailed cost plans, cash flow forecasting" },
    "advanced": { "scene_types": ["cost_plan","pbl","measurement"], "scene_count": 7, "topic_hint": "value engineering, life cycle costing, cost optimization" }
  }'
),
(
  'Construction Materials',
  'construction-materials',
  'Properties, uses, and specifications of construction materials in the Nigerian context.',
  '🏗️',
  5,
  '{
    "beginner": { "scene_types": ["lecture","quiz","discussion"], "scene_count": 5, "topic_hint": "common materials: cement, sand, aggregate, steel, timber" },
    "intermediate": { "scene_types": ["lecture","quiz","pbl"], "scene_count": 6, "topic_hint": "material testing, quality standards, Nigerian standards" },
    "advanced": { "scene_types": ["pbl","discussion","measurement"], "scene_count": 7, "topic_hint": "material selection, sustainability, local alternatives" }
  }'
),
(
  'Construction Methods',
  'construction-methods',
  'Construction techniques, sequences, and logistics for Nigerian building projects.',
  '⚙️',
  6,
  '{
    "beginner": { "scene_types": ["lecture","quiz","pbl"], "scene_count": 5, "topic_hint": "construction sequence, basic methods, site organization" },
    "intermediate": { "scene_types": ["pbl","discussion","measurement"], "scene_count": 6, "topic_hint": "method selection, productivity, planning" },
    "advanced": { "scene_types": ["pbl","discussion","boq"], "scene_count": 7, "topic_hint": "complex projects, method statements, resource optimization" }
  }'
),
(
  'Contracts & Procurement',
  'contracts-procurement',
  'FIDIC conditions, tendering processes, contract administration, and procurement strategies.',
  '📋',
  7,
  '{
    "beginner": { "scene_types": ["lecture","quiz","discussion"], "scene_count": 5, "topic_hint": "contract types, tender process, basic FIDIC" },
    "intermediate": { "scene_types": ["discussion","pbl","rate_analysis"], "scene_count": 6, "topic_hint": "contract administration, claims, variations" },
    "advanced": { "scene_types": ["discussion","pbl","cost_plan"], "scene_count": 7, "topic_hint": "dispute resolution, arbitration, procurement strategy" }
  }'
),
(
  'Project Management',
  'project-management',
  'Planning, scheduling, valuation, and claims management for construction projects.',
  '📅',
  8,
  '{
    "beginner": { "scene_types": ["lecture","quiz","pbl"], "scene_count": 5, "topic_hint": "project phases, basic scheduling, Gantt charts" },
    "intermediate": { "scene_types": ["pbl","discussion","cost_plan"], "scene_count": 6, "topic_hint": "earned value, progress monitoring, resource planning" },
    "advanced": { "scene_types": ["pbl","discussion","boq"], "scene_count": 7, "topic_hint": "claims analysis, delay damages, project recovery" }
  }'
)
ON CONFLICT (slug) DO NOTHING;
