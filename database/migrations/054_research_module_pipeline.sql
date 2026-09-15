-- ============================================================
--  Migration 054: QS Research Module
--  10-stage research pipeline, literature sources, cost data
-- ============================================================

-- ─── 1. RESEARCH PROJECTS ───────────────────────────────────
-- The 10-stage research pipeline

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
  stage_data jsonb DEFAULT '{}'::jsonb,
  -- stage_1: { title, objectives[], keywords[], research_question }
  -- stage_2: { sources: [{id, title, authors[], year, type, relevance_score, notes}] }
  -- stage_3: { themes: [{theme, sources[], synthesis, gaps}] }
  -- stage_4: { method, approach, sample_size, tools[], limitations }
  -- stage_5: { data_points: [{source, value, unit, date, region, notes}] }
  -- stage_6: { analysis_type, findings, charts[], statistical_tests }
  -- stage_7: { sections: [{heading, content, word_count, references[]}] }
  -- stage_8: { reviewers: [{name, feedback, score, criteria}] }
  -- stage_9: { revisions: [{section, before, after, reason, status}] }
  -- stage_10: { final_abstract, keywords[], word_count, archived_at }
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

-- ─── 2. LITERATURE SOURCES ──────────────────────────────────
-- Shared library of QS research sources (AI-curated + user-added)

CREATE TABLE IF NOT EXISTS research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  authors text[] DEFAULT '{}',
  year integer,
  source_type text NOT NULL
    CHECK (source_type IN ('journal', 'book', 'report', 'standard', 'thesis', 'website', 'niqs_bulletin', 'government_data')),
  url text,
  doi text,
  abstract text,
  keywords text[] DEFAULT '{}',
  region text DEFAULT 'Nigeria',
  access_count integer DEFAULT 0,
  avg_relevance_score decimal(3,2) DEFAULT 0,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_type ON research_sources(source_type);
CREATE INDEX idx_source_keywords ON research_sources USING gin(keywords);
CREATE INDEX idx_source_year ON research_sources(year DESC);

-- ─── 3. COST DATA ───────────────────────────────────────────
-- Aggregated market data for QS research

CREATE TABLE IF NOT EXISTS research_cost_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_description text NOT NULL,
  unit text NOT NULL,
  rate_ngn decimal(12,2) NOT NULL,
  region text NOT NULL,
  state text,
  source text,
  date_collected date NOT NULL DEFAULT CURRENT_DATE,
  confidence text DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  project_type text,
  tags text[] DEFAULT '{}',
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_item ON research_cost_data(item_description);
CREATE INDEX idx_cost_region ON research_cost_data(region);
CREATE INDEX idx_cost_date ON research_cost_data(date_collected DESC);

-- ─── 4. COLLABORATIONS ──────────────────────────────────────
-- Shared research projects

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

CREATE INDEX idx_collab_project ON research_collaborations(project_id);
CREATE INDEX idx_collab_user ON research_collaborations(user_id);

-- ─── 5. METHODOLOGY TEMPLATES ───────────────────────────────
-- Pre-built research methodology templates

CREATE TABLE IF NOT EXISTS research_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  research_type text NOT NULL,
  methodology text NOT NULL,
  stages jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { "1": "Define your research question using FINER criteria...", "2": "Search for sources...", ... }
  is_system boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. UPDATED_AT TRIGGERS ─────────────────────────────────

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

-- ─── 7. RLS POLICIES ────────────────────────────────────────

ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_cost_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_templates ENABLE ROW LEVEL SECURITY;

-- Published sources and cost data readable by all
CREATE POLICY "research_sources_read" ON research_sources FOR SELECT USING (true);
CREATE POLICY "research_cost_data_read" ON research_cost_data FOR SELECT USING (true);
CREATE POLICY "research_templates_read" ON research_templates FOR SELECT USING (true);

-- Own projects
CREATE POLICY "research_projects_own" ON research_projects FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- Collaborations
CREATE POLICY "research_collab_own" ON research_collaborations FOR ALL
  USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- ─── 8. SEED METHODOLOGY TEMPLATES ──────────────────────────

INSERT INTO research_templates (name, description, research_type, methodology, stages) VALUES
('Literature Review', 'Systematic review of existing QS research and standards', 'literature_review', 'systematic',
 '{"1":"Define research question and scope","2":"Search academic databases and NIQS bulletins","3":"Apply inclusion/exclusion criteria","4":"Synthesize findings by theme","5":"Identify gaps in current literature","6":"Write review with proper citations","7":"Self-review for completeness","8":"Peer review","9":"Revise based on feedback","10":"Finalize and archive"}'),

('Cost Data Analysis', 'Analyze market rates and cost trends across Nigerian regions', 'cost_data_analysis', 'quantitative',
 '{"1":"Define cost items and regions to analyze","2":"Collect data from BOQs and market surveys","3":"Clean and validate data points","4":"Statistical analysis by region","5":"Identify trends and outliers","6":"Create visualizations","7":"Draft findings","8":"Expert review","9":"Revise analysis","10":"Publish report"}'),

('Case Study', 'In-depth study of a specific QS project or practice', 'case_study', 'qualitative',
 '{"1":"Select case and define objectives","2":"Gather background literature","3":"Design data collection approach","4":"Collect project data and interviews","5":"Analyze case data","6":"Identify key findings","7":"Write case narrative","8":"Expert review","9":"Revise and validate","10":"Archive with lessons learned"}'),

('Policy Review', 'Analysis of QS industry policies and regulations', 'policy_review', 'mixed',
 '{"1":"Define policy area and scope","2":"Collect relevant policies and standards","3":"Map policy landscape","4":"Analyze impact on QS practice","5":"Gather stakeholder perspectives","6":"Synthesize findings","7":"Draft policy analysis","8":"Peer review","9":"Revise recommendations","10":"Finalize and share"}');
