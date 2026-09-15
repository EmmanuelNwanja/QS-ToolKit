# QSToolkit V2.0 — Major Upgrade Implementation Plan

**Date:** 2026-09-14
**Author:** Dr. Q Engineering Team
**Status:** Draft
**Reference:** OpenMAIC (AI Course Generation), ARS (Research Pipeline)

---

## 0. What Already Exists (Inventory)

Before planning new work, here is what is already built and working:

| Feature | Backend | Frontend | DB Tables |
|---------|---------|----------|-----------|
| Academy Subscriptions | `academyController.js` (1650 lines) | `/academy`, `/academy/pathways`, `/academy/arena`, `/academy/resources` | `academy_subscriptions`, `academy_profiles`, `academy_admission_tests`, `academy_pathways`, `academy_pathway_progress`, `academy_resources`, `academy_contests`, `academy_contest_participants`, `academy_tokens` |
| Exam Prep | `examPrepController.js` (1374 lines) | `/exam-prep`, `/exam-prep/professional`, `/exam-prep/students`, `/exam-prep/results` | `exam_prep_subscriptions`, `exam_questions`, `exam_attempts`, `exam_trials`, `exam_definitions`, `exam_universities`, `exam_courses` |
| AI Service | `aiService.js` (1210+ lines) — Gemini/GROQ/OpenRouter fallback chain | `AiChatWidget.jsx` | `ai_conversations`, `ai_usage_daily`, `agent_instincts` |
| Payment | Paystack + Flutterwave + bank transfer | Subscription pages | `direct_payment_submissions`, `user_subscriptions`, `billing_transactions` |

**Key insight:** Academy and Exam Prep are feature-complete for V1. The upgrade is about adding AI-powered content generation, interactive simulations, analytics, and the Research module — not rebuilding what exists.

---

## 1. Phase Breakdown

### Phase 1: AI Content Generation for Academy (Weeks 1–2)
**Goal:** Replace static resource library with AI-generated, pathway-specific lessons.

What ships:
- AI lesson generation endpoint (Dr. Q generates lesson content per module/topic)
- Interactive QS simulations (BOQ scenario generator, rate analysis walkthrough)
- Whiteboard integration (collaborative markup on drawings within lessons)
- Lesson progress tracking and completion certificates

What does NOT ship yet: Research module, exam analytics dashboard, adaptive difficulty.

### Phase 2: Exam Prep AI Upgrade (Weeks 3–4)
**Goal:** Make exam prep adaptive and analytics-driven.

What ships:
- AI Exam Generator (dynamic question generation from topic + difficulty)
- Adaptive difficulty engine (adjusts based on user performance history)
- Interactive Exam Mode (timed, proctored-style with instant feedback)
- Exam Analytics Dashboard (score trends, weakness heatmap, pass probability)

What does NOT ship yet: Research module.

### Phase 3: Research Module — Foundation (Weeks 5–7)
**Goal:** Build the 10-stage research pipeline with Nigerian QS context.

What ships:
- QS Literature Review tool (search + summarize academic papers, NIQS bulletins)
- Cost Data Research (aggregate market rates across regions)
- Research Methodology Guide (structured templates for QS research)
- Full research pipeline: Topic → Literature → Methodology → Data Collection → Analysis → Draft → Review → Revision → Final → Archive

What does NOT ship yet: Collaborative research, external API integrations beyond Gemini.

### Phase 4: Freemium + Polish (Week 8)
**Goal:** Enforce paywall, optimize, and harden.

What ships:
- Freemium/Premium split enforced across all features
- "Coming Soon" landing page for Research (if Phase 3 slips)
- Performance optimization, error handling, monitoring
- Admin analytics for new features

---

## 2. Database Schema Additions

### Migration 052: Academy AI Lessons

```sql
-- AI-generated lessons tied to pathway modules
CREATE TABLE IF NOT EXISTS academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  module_id text NOT NULL, -- references pathway levels JSONB
  title text NOT NULL,
  content jsonb NOT NULL, -- { sections: [{heading, body, diagrams[], examples[]}] }
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

-- User lesson progress
CREATE TABLE IF NOT EXISTS academy_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completion_pct decimal(5,2) DEFAULT 0,
  time_spent_seconds integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Interactive QS simulations (BOQ scenarios, rate analysis walkthroughs)
CREATE TABLE IF NOT EXISTS academy_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES academy_pathways(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  simulation_type text NOT NULL
    CHECK (simulation_type IN ('boq_scenario', 'rate_analysis', 'measurement_takeoff', 'cost_plan')),
  config jsonb NOT NULL,
  -- config structure varies by type:
  -- boq_scenario: { project_type, rooms[], budget_range, difficulty }
  -- rate_analysis: { item_description, unit, historical_rates[], region }
  -- measurement_takeoff: { drawing_url, elements[], standard }
  -- cost_plan: { building_type, area_m2, location, specifications }
  difficulty text DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Whiteboard annotations on drawings within lessons
CREATE TABLE IF NOT EXISTS academy_whiteboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES academy_lessons(id) ON DELETE SET NULL,
  simulation_id uuid REFERENCES academy_simulations(id) ON DELETE SET NULL,
  drawing_url text,
  annotations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- annotations: [{ type, x, y, width, height, text, color, author }]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whiteboard_user ON academy_whiteboard(user_id);
CREATE INDEX idx_whiteboard_lesson ON academy_whiteboard(lesson_id);
```

### Migration 053: Exam Prep AI Upgrade

```sql
-- Adaptive difficulty profile per user per exam topic
CREATE TABLE IF NOT EXISTS exam_difficulty_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  current_level text DEFAULT 'medium'
    CHECK (current_level IN ('easy', 'medium', 'hard')),
  -- Rolling average: last 20 questions
  correct_rate decimal(5,4) DEFAULT 0,
  questions_attempted integer DEFAULT 0,
  streak_correct integer DEFAULT 0,
  streak_incorrect integer DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic)
);

-- AI-generated practice exams (dynamic, not from bank)
CREATE TABLE IF NOT EXISTS exam_ai_generated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category text NOT NULL,
  exam_name text NOT NULL,
  topic text NOT NULL,
  difficulty text NOT NULL,
  questions jsonb NOT NULL, -- AI-generated questions
  generation_prompt text, -- for audit
  model_used text DEFAULT 'gemini-2.0-flash',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_ai_user ON exam_ai_generated(user_id);
CREATE INDEX idx_exam_ai_category ON exam_ai_generated(exam_category);

-- Exam analytics snapshots (aggregated per exam/session)
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
  -- { "Measurement": { correct: 5, total: 8 }, "Contracts": { correct: 3, total: 6 } }
  weakness_areas text[] DEFAULT '{}',
  pass_probability decimal(5,4) DEFAULT 0,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, exam_category, exam_name)
);
```

### Migration 054: Research Module

```sql
-- Research projects (the 10-stage pipeline)
CREATE TABLE IF NOT EXISTS research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  research_type text NOT NULL
    CHECK (research_type IN (
      'literature_review', 'cost_data_analysis', 'methodology_guide',
      'case_study', 'comparative_analysis', 'policy_review', 'other'
    )),
  current_stage integer DEFAULT 1
    CHECK (current_stage BETWEEN 1 AND 10),
  -- 1: Topic Definition
  -- 2: Literature Search
  -- 3: Literature Review
  -- 4: Methodology Design
  -- 5: Data Collection
  -- 6: Data Analysis
  -- 7: Draft Writing
  -- 8: Peer Review
  -- 9: Revision
  -- 10: Final & Archive
  stage_data jsonb DEFAULT '{}'::jsonb,
  -- { stage_1: { title, objectives[], keywords[] },
  --   stage_2: { sources: [{title, author, year, url, summary, relevance_score}] },
  --   stage_3: { themes: [{theme, sources[], synthesis}] },
  --   stage_4: { method: "quantitative|qualitative|mixed", approach, sample_size, limitations },
  --   stage_5: { data_points: [{source, value, date, region, notes}] },
  --   stage_6: { analysis_type, findings, charts[] },
  --   stage_7: { sections: [{heading, content, references[]}] },
  --   stage_8: { reviewers: [{name, feedback, rating}], overall_score },
  --   stage_9: { revisions: [{section, before, after, reason}] },
  --   stage_10: { final_url, archived_at } }
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'under_review', 'completed', 'archived')),
  is_public boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_user ON research_projects(user_id);
CREATE INDEX idx_research_type ON research_projects(research_type);
CREATE INDEX idx_research_status ON research_projects(status);

-- Literature sources library (shared across users, AI-curated)
CREATE TABLE IF NOT EXISTS research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  authors text[] DEFAULT '{}',
  year integer,
  source_type text NOT NULL
    CHECK (source_type IN ('journal', 'book', 'report', 'standard', 'thesis', 'website', 'niqs_bulletin', 'government_data')),
  url text,
  abstract text,
  keywords text[] DEFAULT '{}',
  region text DEFAULT 'Nigeria',
  -- Regional relevance
  access_count integer DEFAULT 0,
  avg_relevance_score decimal(3,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_type ON research_sources(source_type);
CREATE INDEX idx_source_keywords ON research_sources USING gin(keywords);
CREATE INDEX idx_source_year ON research_sources(year DESC);

-- Cost data points (aggregated market data for research)
CREATE TABLE IF NOT EXISTS research_cost_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_description text NOT NULL,
  unit text NOT NULL,
  rate_ngn decimal(12,2) NOT NULL,
  region text NOT NULL,
  state text,
  source text, -- 'user_boq', 'market_survey', 'niqs_rate', 'ai_estimate'
  date_collected date NOT NULL DEFAULT CURRENT_DATE,
  confidence text DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  project_type text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_item ON research_cost_data(item_description);
CREATE INDEX idx_cost_region ON research_cost_data(region);
CREATE INDEX idx_cost_date ON research_cost_data(date_collected DESC);

-- Research collaborations
CREATE TABLE IF NOT EXISTS research_collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'editor', 'reviewer', 'viewer')),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(project_id, user_id)
);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_research_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_projects_updated ON research_projects;
CREATE TRIGGER research_projects_updated
  BEFORE UPDATE ON research_projects
  FOR EACH ROW EXECUTE FUNCTION update_research_timestamp();

DROP TRIGGER IF EXISTS research_whiteboard_updated ON academy_whiteboard;
CREATE TRIGGER research_whiteboard_updated
  BEFORE UPDATE ON academy_whiteboard
  FOR EACH ROW EXECUTE FUNCTION update_research_timestamp();

DROP TRIGGER IF EXISTS research_difficulty_updated ON exam_difficulty_profiles;
CREATE TRIGGER research_difficulty_updated
  BEFORE UPDATE ON exam_difficulty_profiles
  FOR EACH ROW EXECUTE FUNCTION update_research_timestamp();

DROP TRIGGER IF EXISTS research_analytics_updated ON exam_analytics;
CREATE TRIGGER research_analytics_updated
  BEFORE UPDATE ON exam_analytics
  FOR EACH ROW EXECUTE FUNCTION update_research_timestamp();

-- RLS policies
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_whiteboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_difficulty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_ai_generated ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_cost_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_collaborations ENABLE ROW LEVEL SECURITY;

-- Read policies for shared tables
CREATE POLICY "academy_lessons_read" ON academy_lessons FOR SELECT USING (is_published = true);
CREATE POLICY "academy_simulations_read" ON academy_simulations FOR SELECT USING (is_published = true);
CREATE POLICY "research_sources_read" ON research_sources FOR SELECT USING (true);
CREATE POLICY "research_cost_data_read" ON research_cost_data FOR SELECT USING (true);

-- Own-data policies
CREATE POLICY "lesson_progress_own" ON academy_lesson_progress FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "whiteboard_own" ON academy_whiteboard FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "difficulty_profiles_own" ON exam_difficulty_profiles FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "exam_ai_generated_own" ON exam_ai_generated FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "exam_analytics_own" ON exam_analytics FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "research_projects_own" ON research_projects FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "research_collab_own" ON research_collaborations FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```

---

## 3. Backend Endpoints

### Phase 1: Academy AI Lessons (`/api/v1/academy/`)

| Method | Route | Auth | Premium | Description |
|--------|-------|------|---------|-------------|
| POST | `/lessons/generate` | Yes | Yes | AI generates lesson content for a module/topic |
| GET | `/lessons` | Yes | Yes | List lessons (filterable by pathway, module, difficulty) |
| GET | `/lessons/:id` | Yes | Yes | Get lesson content |
| POST | `/lessons/:id/complete` | Yes | Yes | Mark lesson complete, update progress |
| GET | `/lessons/progress` | Yes | Yes | Get lesson completion stats |
| POST | `/simulations` | Yes | Yes | Create simulation scenario (AI-generated) |
| GET | `/simulations` | Yes | Yes | List available simulations |
| POST | `/simulations/:id/start` | Yes | Yes | Start simulation session |
| POST | `/simulations/:id/submit` | Yes | Yes | Submit simulation answers/decisions |
| POST | `/whiteboard/save` | Yes | Yes | Save whiteboard annotations |
| GET | `/whiteboard/:lessonId` | Yes | Yes | Load whiteboard for lesson |

**AI lesson generation prompt pattern:**
```javascript
// In aiService.js — new export
exports.generateAcademyLesson = async (pathway, module, topic, difficulty) => {
  const prompt = `
You are Dr. Q, generating a structured lesson for Nigerian Quantity Surveying students.

Pathway: ${pathway.title} (${pathway.focus_area})
Module: ${module}
Topic: ${topic}
Difficulty: ${difficulty}

Generate a complete lesson with:
1. Learning objectives (3-5)
2. Core content (3-5 sections with headings)
3. Nigerian QS examples (use ₦, local materials, SMM7/NRM2 references)
4. Practice questions (3-5)
5. Key takeaways

Output JSON: {
  "objectives": ["..."],
  "sections": [{ "heading": "...", "body": "...", "examples": ["..."] }],
  "practice_questions": [{ "question": "...", "options": ["A", "B", "C", "D"], "correct": "B", "explanation": "..." }],
  "takeaways": ["..."],
  "estimated_minutes": 15
}`;
  return callAI(prompt, { temperature: 0.4 });
};
```

### Phase 2: Exam Prep AI (`/api/v1/exam-prep/`)

| Method | Route | Auth | Premium | Description |
|--------|-------|------|---------|-------------|
| POST | `/practice/generate-ai` | Yes | Yes | AI generates fresh exam questions from topic |
| POST | `/practice/start-interactive` | Yes | Yes | Start interactive mode (answer-by-answer feedback) |
| POST | `/practice/submit-answer` | Yes | Yes | Submit single answer, get instant feedback + difficulty adjust |
| POST | `/practice/finish` | Yes | Yes | End interactive session, get summary |
| GET | `/analytics` | Yes | Yes | Get exam analytics dashboard data |
| GET | `/analytics/topic-breakdown` | Yes | Yes | Topic-level performance breakdown |
| GET | `/analytics/weaknesses` | Yes | Yes | Identified weakness areas |
| GET | `/analytics/pass-probability` | Yes | Yes | Estimated pass probability for a target exam |

**Adaptive difficulty logic (in examPrepController.js):**
```javascript
// After each answer submission:
async function updateDifficultyProfile(userId, topic, wasCorrect) {
  const { data: profile } = await supabase
    .from('exam_difficulty_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic)
    .maybeSingle();

  const streak = wasCorrect
    ? (profile?.streak_correct || 0) + 1
    : 0;
  const streakIncorrect = wasCorrect
    ? 0
    : (profile?.streak_incorrect || 0) + 1;

  let newLevel = profile?.current_level || 'medium';
  const correctRate = profile?.questions_attempted
    ? ((profile.correct_rate * profile.questions_attempted) + (wasCorrect ? 1 : 0)) / (profile.questions_attempted + 1)
    : wasCorrect ? 1 : 0;

  // Promote after 3 consecutive correct at current level
  if (streak >= 3 && newLevel === 'easy') newLevel = 'medium';
  else if (streak >= 3 && newLevel === 'medium') newLevel = 'hard';

  // Demote after 3 consecutive incorrect at current level
  if (streakIncorrect >= 3 && newLevel === 'hard') newLevel = 'medium';
  else if (streakIncorrect >= 3 && newLevel === 'medium') newLevel = 'easy';

  await supabase.from('exam_difficulty_profiles').upsert({
    user_id: userId, topic, current_level: newLevel,
    correct_rate: correctRate,
    questions_attempted: (profile?.questions_attempted || 0) + 1,
    streak_correct: streak, streak_incorrect: streakIncorrect,
    last_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,topic' });

  return newLevel;
}
```

### Phase 3: Research Module (`/api/v1/research/`)

| Method | Route | Auth | Premium | Description |
|--------|-------|------|---------|-------------|
| POST | `/projects` | Yes | Yes | Create new research project |
| GET | `/projects` | Yes | Yes | List user's research projects |
| GET | `/projects/:id` | Yes | Yes | Get project detail + stage data |
| PUT | `/projects/:id` | Yes | Yes | Update project (title, description, tags) |
| POST | `/projects/:id/advance` | Yes | Yes | Advance to next stage |
| POST | `/projects/:id/stage/:num` | Yes | Yes | Save/update data for a specific stage |
| POST | `/projects/:id/ai-assist` | Yes | Yes | AI assists current stage (varies by stage) |
| DELETE | `/projects/:id` | Yes | Yes | Delete research project |
| POST | `/projects/:id/collaborate` | Yes | Yes | Invite collaborator |
| GET | `/sources` | Yes | Yes | Search literature sources |
| GET | `/sources/:id` | Yes | Yes | Get source detail |
| POST | `/sources` | Yes | Yes | Add new source (curated by user) |
| GET | `/cost-data` | Yes | Yes | Search cost data points |
| POST | `/cost-data` | Yes | Yes | Contribute cost data point |
| GET | `/cost-data/aggregate` | Yes | Yes | Aggregated cost data by region/item |
| GET | `/methodology-templates` | Yes | Yes | List research methodology templates |

**AI assist patterns by stage:**

| Stage | AI Action | Prompt Pattern |
|-------|-----------|----------------|
| 1. Topic Definition | Refine research question, suggest keywords | "Given this QS research topic, suggest 3 focused research questions and 10 keywords" |
| 2. Literature Search | Find relevant sources from knowledge base | "Search for papers on [topic] relevant to Nigerian QS practice" |
| 3. Literature Review | Synthesize themes from sources | "Synthesize these 5 sources into key themes about [topic]" |
| 4. Methodology | Suggest research design | "Suggest a research methodology for studying [topic] in Nigerian construction" |
| 5. Data Collection | Generate survey templates, suggest data points | "Generate a data collection template for [topic] with Nigerian context" |
| 6. Data Analysis | Interpret data, suggest statistical methods | "Analyze these data points and suggest visualizations" |
| 7. Draft Writing | Generate draft sections | "Write a literature review section on [topic] using these sources" |
| 8. Peer Review | Simulated review feedback | "Review this draft for academic rigor, Nigerian QS relevance, and methodology soundness" |
| 9. Revision | Suggest improvements | "Compare these two versions and highlight improvements needed" |
| 10. Archive | Generate abstract, keywords | "Generate an abstract for this completed research" |

---

## 4. Frontend Pages & Components

### New Pages

| Route | Page | Phase | Auth |
|-------|------|-------|------|
| `/academy/lessons` | AI Lesson Library | 1 | Yes |
| `/academy/lessons/[id]` | Lesson Viewer (with whiteboard) | 1 | Yes |
| `/academy/simulations` | QS Simulation Hub | 1 | Yes |
| `/academy/simulations/[id]` | Simulation Workspace | 1 | Yes |
| `/exam-prep/interactive` | Interactive Practice Mode | 2 | Yes |
| `/exam-prep/analytics` | Exam Analytics Dashboard | 2 | Yes |
| `/research` | Research Dashboard | 3 | Yes |
| `/research/new` | Create Research Project | 3 | Yes |
| `/research/[id]` | Research Pipeline Workspace | 3 | Yes |
| `/research/sources` | Literature Source Browser | 3 | Yes |
| `/research/cost-data` | Cost Data Explorer | 3 | Yes |

### New Components

| Component | Phase | Description |
|-----------|-------|-------------|
| `LessonViewer.jsx` | 1 | Renders AI-generated lesson with sections, examples, practice questions |
| `WhiteboardCanvas.jsx` | 1 | HTML5 Canvas-based drawing annotation tool |
| `SimulationRunner.jsx` | 1 | Interactive BOQ/rate analysis simulation |
| `SimulationDecisionPanel.jsx` | 1 | User input for simulation decisions |
| `InteractiveExamMode.jsx` | 2 | Answer-by-answer exam with instant feedback |
| `DifficultyBadge.jsx` | 2 | Shows current difficulty level + trend |
| `AnalyticsDashboard.jsx` | 2 | Charts: score trends, weakness heatmap, pass probability |
| `TopicBreakdownChart.jsx` | 2 | Bar/radar chart of topic-level performance |
| `ResearchPipeline.jsx` | 3 | 10-stage pipeline stepper UI |
| `ResearchStageForm.jsx` | 3 | Stage-specific input forms |
| `SourceSearchPanel.jsx` | 3 | Literature search with AI relevance scoring |
| `CostDataGrid.jsx` | 3 | Filterable/sortable cost data table |
| `MethodologyTemplates.jsx` | 3 | Pre-built research methodology templates |
| `FreemiumGate.jsx` | 4 | Reusable paywall component |

### Updated Pages

| Page | Change |
|------|--------|
| `/academy` | Add "Lessons" and "Simulations" cards to dashboard |
| `/exam-prep` | Add "Interactive Mode" and "Analytics" cards |
| `/academy/resources` | Mix AI-generated lessons with curated resources |
| `/exam-prep/practice` | Add "AI Generate" option alongside bank questions |

---

## 5. AI Integration Patterns

### Pattern 1: Lesson Generation (Stateless)

```
User requests lesson → Backend builds prompt with pathway context →
Gemini generates structured JSON → Self-critique gate →
Store in academy_lessons → Return to frontend
```

- **Model:** Gemini 2.0 Flash (free tier, fast)
- **Caching:** Store generated lessons in DB. Regenerate only on explicit user request or content staleness (>30 days).
- **Cost control:** 1 lesson generation = 1 AI call. At 1,500 req/day free, this supports ~500 lesson generations/day across all users.

### Pattern 2: Adaptive Exam (Stateless + DB State)

```
User answers question → Check difficulty_profiles →
Determine next question difficulty → AI generates question if needed →
Update difficulty_profiles → Return question + feedback
```

- **Model:** Gemini 2.0 Flash for question generation, GROQ (Llama 3.3 70B) for explanations (faster, free)
- **Caching:** Questions from bank (`exam_questions`) are cached by default. AI-generated questions stored in `exam_ai_generated` for reuse.
- **Cost control:** Adaptive engine uses bank questions first. AI generation only when user exhausts bank questions for a topic.

### Pattern 3: Research AI Assist (Stateless, Stage-Aware)

```
User clicks "AI Assist" on stage N → Backend reads project stage_data →
Builds stage-specific prompt → Gemini generates stage output →
User reviews/edits → Store updated stage_data
```

- **Model:** Gemini 2.0 Flash for generation, Gemini for literature relevance scoring
- **Caching:** Literature sources cached in `research_sources` table. Cost data cached in `research_cost_data`.
- **Cost control:** AI assist limited to 20 calls/day per user on free tier, unlimited on premium.

### Pattern 4: Simulation Generation (Stateless)

```
User selects simulation type + parameters →
AI generates scenario config (BOQ, rates, measurements) →
Stored in academy_simulations → User interacts in simulation runner
```

- **Model:** Gemini 2.0 Flash
- **Caching:** Simulations stored and reused. User-specific variations generated on demand.

### Unified Rate Limiting

Add to `aiService.js`:

```javascript
// New rate limit tiers for new features
const FEATURE_LIMITS = {
  free: {
    lessons_per_day: 0,      // Free users cannot generate lessons
    simulations_per_day: 0,  // Free users cannot run simulations
    ai_exam_per_day: 5,      // Free users get 5 AI-generated questions/day
    research_ai_per_day: 0,  // Free users cannot use AI research assist
  },
  basic: {
    lessons_per_day: 5,
    simulations_per_day: 3,
    ai_exam_per_day: 20,
    research_ai_per_day: 5,
  },
  pro: {
    lessons_per_day: 50,
    simulations_per_day: 20,
    ai_exam_per_day: 100,
    research_ai_per_day: 50,
  },
  enterprise: {
    lessons_per_day: 999,
    simulations_per_day: 999,
    ai_exam_per_day: 999,
    research_ai_per_day: 999,
  }
};
```

---

## 6. Freemium vs Premium Split

### What's Free (No Add-On Required)

| Feature | Free Tier | Basic Plan | Pro Plan |
|---------|-----------|------------|----------|
| Academy Dashboard | View only | Full access | Full access |
| Pathway Browse | Browse 1 lesson per pathway | All lessons | All lessons |
| Admission Test | 1 free trial | Included | Included |
| Arena Contests | 3/month | Unlimited | Unlimited |
| Exam Prep | 1 free exam trial | All bank exams | All bank exams |
| AI Chat (Dr. Q) | 3/day | 50/day | 200/day |
| BOQ Tools | Unlimited | Unlimited | Unlimited |

### What Requires Academy Add-On (₦2,000/week)

| Feature | What You Get |
|---------|-------------|
| AI Lesson Generation | Unlimited AI-generated lessons per pathway |
| QS Simulations | Full simulation library + custom scenarios |
| Whiteboard Integration | Save/load annotations on drawings |
| Advanced Pathway Analytics | Detailed progress, streaks, recommendations |
| Arena Unlimited | Unlimited contest creation + participation |
| Token Boosts | 2x token earnings in arena |

### What Requires Exam Prep Add-On (₦2,000/week)

| Feature | What You Get |
|---------|-------------|
| Full Question Bank | All professional + university past questions |
| AI Exam Generator | Dynamic question generation from any topic |
| Adaptive Difficulty | Engine adjusts to your level |
| Interactive Exam Mode | Answer-by-answer feedback + explanations |
| Exam Analytics Dashboard | Score trends, weakness heatmap, pass probability |
| AI Explanations | Detailed step-by-step explanations for wrong answers |

### What Requires Research Add-On (₦3,000/week or ₦10,000/month)

| Feature | What You Get |
|---------|-------------|
| Research Projects | Full 10-stage pipeline |
| Literature Review Tool | AI-assisted source search + synthesis |
| Cost Data Access | Aggregate market data by region/item |
| Research Templates | Methodology templates for QS research |
| AI Research Assist | 50 AI assists/day across all stages |
| Collaboration | Invite 2 collaborators per project |
| Export | Export research as PDF/DOCX |

### "Coming Soon" Strategy for Research

If Phase 3 is not ready at launch:

1. **Landing page at `/research`:**
   ```
   "QS Research Hub — Coming Q4 2026
   
   Build literature reviews, analyze cost data, and conduct
   rigorous QS research with AI assistance.
   
   10-stage research pipeline:
   Topic → Literature → Methodology → Data → Analysis →
   Draft → Review → Revision → Final → Archive
   
   [Notify Me] [Learn More]"
   ```

2. **Pre-launch data collection:**
   - Seed `research_sources` table with Nigerian QS literature during Phase 1-2
   - Seed `research_cost_data` with aggregated data from existing BOQs
   - This means when Research launches, there's already data to show

3. **Beta access:**
   - Offer early access to 10-20 power users (Pro plan holders)
   - Collect feedback before general availability

---

## 7. Implementation Sequence (Detailed)

### Week 1-2: Academy AI Lessons

**Backend:**
1. Migration 052 (academy_lessons, academy_lesson_progress, academy_simulations, academy_whiteboard)
2. Add `generateAcademyLesson` to `aiService.js`
3. Add lesson CRUD endpoints to `academyController.js`
4. Add simulation endpoints
5. Add whiteboard save/load endpoints
6. Add rate limiting for new features

**Frontend:**
1. `/academy/lessons` page — grid of lessons by pathway
2. `LessonViewer.jsx` — markdown renderer + practice questions
3. `WhiteboardCanvas.jsx` — basic annotation tool (fabric.js or native Canvas)
4. `/academy/simulations` page — simulation cards
5. `SimulationRunner.jsx` — interactive BOQ scenario
6. Update `/academy` dashboard with new cards

**Seed content:**
- Generate 5 AI lessons per pathway (35 total) using the AI endpoint
- Create 3 simulation templates: BOQ Scenario, Rate Analysis, Measurement Takeoff

### Week 3-4: Exam Prep AI

**Backend:**
1. Migration 053 (exam_difficulty_profiles, exam_ai_generated, exam_analytics)
2. Add `generateExamQuestions` to `aiService.js` (separate from practiceExam — focused on dynamic generation)
3. Add adaptive difficulty engine to `examPrepController.js`
4. Add interactive exam endpoints
5. Add analytics aggregation endpoint
6. Update rate limits

**Frontend:**
1. `/exam-prep/interactive` — answer-by-answer mode with instant feedback
2. `InteractiveExamMode.jsx` — new exam UI component
3. `/exam-prep/analytics` — dashboard with charts (recharts)
4. `TopicBreakdownChart.jsx` — radar/bar chart
5. `DifficultyBadge.jsx` — visual difficulty indicator
6. Update `/exam-prep` dashboard with new cards

**Seed content:**
- Run adaptive engine calibration: seed difficulty profiles from existing exam attempts

### Week 5-7: Research Module

**Backend:**
1. Migration 054 (research_projects, research_sources, research_cost_data, research_collaborations)
2. Add research controller + routes
3. Add `researchAssist` to `aiService.js` (stage-aware prompts)
4. Add source search (full-text on `research_sources`)
5. Add cost data aggregation endpoint
6. Add collaboration endpoints

**Frontend:**
1. `/research` — dashboard with project list
2. `/research/[id]` — 10-stage pipeline stepper UI
3. `ResearchPipeline.jsx` — stage navigation + forms
4. `SourceSearchPanel.jsx` — literature search
5. `CostDataGrid.jsx` — filterable cost data
6. `MethodologyTemplates.jsx` — template selection

**Seed content:**
- Seed 50+ Nigerian QS literature sources (NIQS bulletins, university theses, journal papers)
- Seed cost data from existing BOQs (aggregate by region + item)

### Week 8: Freemium + Polish

**Backend:**
1. Enforce premium checks on all new endpoints
2. Update `checkDailyLimit` with new feature limits
3. Add admin analytics for new features
4. Performance audit (query optimization, index review)

**Frontend:**
1. `FreemiumGate.jsx` — reusable paywall component
2. Update all new pages with premium checks
3. "Coming Soon" page for Research (if needed)
4. Landing page updates
5. Mobile responsiveness audit

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI lesson quality inconsistent | Self-critique gate on all generated content. Cache good results. |
| Free tier AI cost explosion | Hard rate limits per user per day. Graceful degradation to "upgrade" prompt. |
| Research module scope creep | Ship 10-stage pipeline in MVP. Add collaboration, external APIs in V2.1. |
| Whiteboard performance | Use fabric.js (battle-tested). Lazy-load canvas only when lesson opens. |
| Adaptive difficulty gaming | Minimum 5 questions before level change. Streak-based, not single-answer. |
| Migration errors | Test all migrations on Supabase staging before production. Keep rollback SQL. |

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI Lesson Adoption | 40% of academy users generate 3+ lessons in first month | `academy_lessons` created count |
| Simulation Completion | 60% of started simulations completed | `academy_simulations` submission rate |
| Interactive Exam Usage | 30% of exam prep users switch to interactive mode | `exam_ai_generated` vs bank question usage |
| Adaptive Difficulty Accuracy | 70% of users report questions feel "right level" | Post-exam survey |
| Research Projects Started | 50 projects in first month after launch | `research_projects` count |
| Research Projects Completed | 20% of started projects reach Stage 10 | Pipeline completion rate |
| Premium Conversion | 15% of free users upgrade to any add-on | Subscription conversion funnel |
| AI Cost Per User | <₦50/user/month average | `ai_usage_daily` aggregation |

---

*Version: 1.0.0 | QSToolkit V2.0 Major Upgrade Plan*
