-- Migration 041: Search analytics table for exam prep

CREATE TABLE IF NOT EXISTS exam_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  query text NOT NULL,
  search_type text DEFAULT 'all',
  results_count integer DEFAULT 0,
  searched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_logs_user ON exam_search_logs(user_id);
CREATE INDEX idx_search_logs_query ON exam_search_logs USING gin(to_tsvector('english', query));
CREATE INDEX idx_search_logs_date ON exam_search_logs(searched_at);

ALTER TABLE exam_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_search_logs_insert_own" ON exam_search_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exam_search_logs_read_admin" ON exam_search_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND org_role = 'super_admin')
  );
