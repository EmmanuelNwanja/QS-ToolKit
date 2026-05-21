-- ============================================================
--  QSToolkit V1.10 — AI-Native Features Foundation
--  Auto-BOQ, Cost Forecasting, Variance Detection, NL Assistant
--  Document Integrity (Blockchain-lite), Smart Rate Suggestions
-- ============================================================

-- ─── AI CONVERSATIONS ─────────────────────────────────────────
-- Stores chat history with the QS AI assistant
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id VARCHAR(64) NOT NULL,           -- client-generated session
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'model', 'system')),
  content TEXT NOT NULL,
  context_type VARCHAR(30),                  -- 'general', 'boq', 'project', 'calculator', 'admin'
  context_id UUID,                           -- optional related record id
  model_used VARCHAR(50) DEFAULT 'gemini-flash',
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user_session ON ai_conversations(user_id, session_id);
CREATE INDEX idx_ai_conversations_created ON ai_conversations(created_at);

-- ─── AI USAGE TRACKING (per-user daily limits) ────────────────
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chat_requests INT DEFAULT 0,
  drawing_analysis_requests INT DEFAULT 0,
  forecast_requests INT DEFAULT 0,
  tokens_consumed INT DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

-- ─── BOQ REVISIONS (for variance detection) ───────────────────
-- Snapshots BOQ state every time status moves to 'final' or 'submitted'
CREATE TABLE IF NOT EXISTS boq_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boq_id UUID REFERENCES boq_documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  revision_number INT NOT NULL,
  snapshot JSONB NOT NULL,                   -- full BOQ JSON snapshot
  change_summary TEXT,                       -- AI or human-written summary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(boq_id, revision_number)
);

CREATE INDEX idx_boq_revisions_boq ON boq_revisions(boq_id, revision_number);

-- ─── DOCUMENT HASHES (Blockchain-lite integrity) ──────────────
-- Tamper-evident chain for BOQs and invoices
CREATE TABLE IF NOT EXISTS document_hashes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('boq', 'invoice', 'quote')),
  document_id UUID NOT NULL,                 -- references boq_documents or invoices
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  document_hash VARCHAR(64) NOT NULL,        -- SHA-256 hex
  previous_hash VARCHAR(64),                 -- previous hash in chain (null for first)
  canonical_json TEXT NOT NULL,              -- the exact JSON that was hashed
  cert_token VARCHAR(64) UNIQUE NOT NULL,    -- public verification token
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_hashes_doc ON document_hashes(document_type, document_id);
CREATE INDEX idx_document_hashes_token ON document_hashes(cert_token);
CREATE INDEX idx_document_hashes_user ON document_hashes(user_id);

-- ─── PROJECT COST FORECASTS ───────────────────────────────────
-- AI-generated cost predictions per project
CREATE TABLE IF NOT EXISTS project_cost_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  forecast_type VARCHAR(30) NOT NULL DEFAULT 'overrun_risk',
  predicted_final_value NUMERIC(18,2),
  confidence_score NUMERIC(5,2),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB DEFAULT '[]'::jsonb,
  recommendation TEXT,
  model_version VARCHAR(30) DEFAULT 'v1.10-local',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, forecast_type)
);

CREATE INDEX idx_forecasts_project ON project_cost_forecasts(project_id);

-- ─── SMART RATE SUGGESTIONS ───────────────────────────────────
-- AI-suggested rates based on user's historical BOQ data
CREATE TABLE IF NOT EXISTS smart_rate_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  item_description_hash VARCHAR(64) NOT NULL, -- hash of normalized description
  item_description_pattern VARCHAR(255) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  suggested_rate NUMERIC(18,2) NOT NULL,
  rate_low NUMERIC(18,2),                    -- 10th percentile
  rate_high NUMERIC(18,2),                   -- 90th percentile
  sample_size INT DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_description_hash, unit)
);

CREATE INDEX idx_smart_rates_user ON smart_rate_suggestions(user_id);

-- ─── DRAWING ANALYSIS JOBS ────────────────────────────────────
-- Async queue for Auto-BOQ from architectural drawings
CREATE TABLE IF NOT EXISTS drawing_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  boq_id UUID REFERENCES boq_documents(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB DEFAULT '{}'::jsonb,  -- raw AI extraction
  draft_boq JSONB DEFAULT '{}'::jsonb,       -- structured BOQ draft
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_drawing_jobs_user ON drawing_analysis_jobs(user_id, status);

-- ─── RAG KNOWLEDGE CHUNKS (Nigerian construction standards) ───
-- Pre-loaded knowledge base for the QS AI assistant
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,             -- 'smm7', 'nrm2', 'nigerian_standards', 'materials', 'methodology'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding JSONB,                           -- stores vector as JSON array for compatibility without pgvector
  source VARCHAR(255),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_category ON knowledge_chunks(category);

-- ─── FEATURE FLAGS (gradual rollout) ──────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  enabled_globally BOOLEAN DEFAULT FALSE,
  enabled_for_plans TEXT[] DEFAULT '{}'::text[], -- e.g. {'pro','enterprise'}
  rollout_percent INT DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (feature_key, name, description, enabled_globally, enabled_for_plans, rollout_percent)
VALUES
  ('ai_chat', 'QS AI Chat Assistant', 'Natural language assistant for quantity surveying', FALSE, ARRAY['pro','enterprise'], 100),
  ('auto_boq_drawings', 'Auto-BOQ from Drawings', 'Upload architectural drawings to generate draft BOQs', FALSE, ARRAY['pro','enterprise'], 100),
  ('cost_forecasting', 'Cost Forecasting', 'AI-powered project cost overrun prediction', FALSE, ARRAY['pro','enterprise'], 100),
  ('variance_detection', 'Variance Detection', 'Compare BOQ revisions and highlight changes', FALSE, ARRAY['pro','enterprise'], 100),
  ('document_integrity', 'Document Integrity', 'SHA-256 tamper-evident certification for documents', FALSE, ARRAY['pro','enterprise'], 100),
  ('smart_rates', 'Smart Rate Suggestions', 'AI-suggested rates from your BOQ history', FALSE, ARRAY['pro','enterprise'], 100),
  ('admin_ai', 'Admin AI Intelligence', 'Natural language analytics for admin dashboard', FALSE, ARRAY['enterprise'], 50)
ON CONFLICT (feature_key) DO NOTHING;

-- ─── HELPER: Increment AI usage (atomic) ────────────────────
CREATE OR REPLACE FUNCTION increment_ai_usage(p_id UUID, p_column TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE ai_usage_daily SET %I = %I + 1 WHERE id = $1',
    p_column, p_column
  ) USING p_id;
END;
$$ LANGUAGE plpgsql;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cost_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_rate_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_own" ON ai_conversations FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "ai_usage_own" ON ai_usage_daily FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "boq_revisions_own" ON boq_revisions FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "document_hashes_own" ON document_hashes FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "forecasts_own" ON project_cost_forecasts FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "smart_rates_own" ON smart_rate_suggestions FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
CREATE POLICY "drawing_jobs_own" ON drawing_analysis_jobs FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
