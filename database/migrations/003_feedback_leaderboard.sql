-- ============================================================
--  QSToolkit - Client Feedback & Leaderboard Schema
--  Run AFTER 002_boq_invoices.sql
-- ============================================================

-- ─── CLIENT FEEDBACK LINKS ───────────────────────────────────
CREATE TABLE feedback_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  message TEXT,                    -- personalised message to client
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CLIENT FEEDBACK RESPONSES ───────────────────────────────
CREATE TABLE feedback_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_link_id UUID REFERENCES feedback_links(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),      -- the surveyor being rated
  project_id UUID REFERENCES projects(id),
  rating INT CHECK (rating >= 1 AND rating <= 10),
  quality_score INT CHECK (quality_score >= 1 AND quality_score <= 10),
  timeliness_score INT CHECK (timeliness_score >= 1 AND timeliness_score <= 10),
  communication_score INT CHECK (communication_score >= 1 AND communication_score <= 10),
  comment TEXT,
  client_name VARCHAR(255),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(50)
);

-- ─── LEADERBOARD VIEW ─────────────────────────────────────────
-- Materialized view for performance
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  u.id AS user_id,
  u.name,
  u.user_type,
  u.company_name,
  u.organization_id,
  COUNT(DISTINCT p.id) AS total_projects,
  COALESCE(SUM(p.final_value), 0) AS total_project_value,
  COUNT(DISTINCT fr.id) AS total_reviews,
  COALESCE(AVG(fr.rating), 0)::NUMERIC(3,1) AS avg_rating,
  COALESCE(AVG(fr.quality_score), 0)::NUMERIC(3,1) AS avg_quality,
  COALESCE(AVG(fr.timeliness_score), 0)::NUMERIC(3,1) AS avg_timeliness,
  COALESCE(AVG(fr.communication_score), 0)::NUMERIC(3,1) AS avg_communication,
  RANK() OVER (ORDER BY COUNT(DISTINCT p.id) DESC, COALESCE(AVG(fr.rating), 0) DESC) AS rank_by_projects,
  RANK() OVER (ORDER BY COALESCE(AVG(fr.rating), 0) DESC, COUNT(DISTINCT p.id) DESC) AS rank_by_rating
FROM users u
LEFT JOIN projects p ON p.user_id = u.id AND p.status = 'completed'
LEFT JOIN feedback_links fl ON fl.user_id = u.id
LEFT JOIN feedback_responses fr ON fr.feedback_link_id = fl.id
WHERE u.user_type IN ('professional', 'company')
GROUP BY u.id, u.name, u.user_type, u.company_name, u.organization_id;

-- Index for fast lookups
CREATE UNIQUE INDEX leaderboard_user_idx ON leaderboard (user_id);

-- Function to refresh leaderboard (called by cron)
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql;

-- ─── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,      -- feedback_received | project_verified | subscription_expiring
  title VARCHAR(255),
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE feedback_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_links_own" ON feedback_links
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "feedback_public_read" ON feedback_responses
  FOR SELECT USING (true);  -- clients can submit via token, public read for leaderboard

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- ─── STORAGE BUCKETS (run in Supabase dashboard or via API) ───
-- These need to be created manually in Supabase Storage:
-- 1. bucket: "branding" (private, 5MB limit, image types only)
-- 2. bucket: "exports"  (private, 20MB limit, pdf/xlsx types)
-- Comment: Go to Supabase > Storage > New Bucket > name it as above
