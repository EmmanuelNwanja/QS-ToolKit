-- ============================================================
--  QSToolkit - Migration 012: Project Milestones
--  Adds project milestone tracking with notes
-- ============================================================

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('planned', 'in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id
  ON project_milestones(project_id);

CREATE INDEX IF NOT EXISTS idx_project_milestones_status
  ON project_milestones(status);
