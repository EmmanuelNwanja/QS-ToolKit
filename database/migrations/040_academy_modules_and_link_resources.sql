-- Migration 040: Create academy_modules table and link resources to pathways
-- This adds the missing learning module infrastructure for QS Academy

-- ─── ACADEMY MODULES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_slug text NOT NULL,
  level integer NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  module_type text NOT NULL DEFAULT 'article' CHECK (module_type IN ('article', 'video', 'quiz', 'exercise', 'case_study', 'worksheet')),
  resource_id uuid REFERENCES academy_resources(id) ON DELETE SET NULL,
  order_index integer DEFAULT 0,
  duration_minutes integer DEFAULT 15,
  points integer DEFAULT 10,
  is_published boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_modules_pathway ON academy_modules(pathway_slug);
CREATE INDEX idx_modules_level ON academy_modules(pathway_slug, level);
CREATE INDEX idx_modules_type ON academy_modules(module_type);

-- Add foreign key for academy_module_progress.module_id
-- (Cannot add FK directly since module_id was created as bare uuid)
-- We'll enforce this at the application level instead.

-- Add pathway_slug to academy_resources if not exists (for linking)
-- This was already added in migration 039, just ensure it's there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'academy_resources' AND column_name = 'pathway_slug'
  ) THEN
    ALTER TABLE academy_resources ADD COLUMN pathway_slug text;
  END IF;
END $$;

-- Link existing resources to pathways based on category
UPDATE academy_resources SET pathway_slug = 'technical-qs-practice' WHERE category IN ('fundamentals') AND pathway_slug IS NULL;
UPDATE academy_resources SET pathway_slug = 'commercial-management' WHERE category IN ('cost_management', 'professional_practice') AND pathway_slug IS NULL;
UPDATE academy_resources SET pathway_slug = 'dispute-resolution' WHERE category IN ('contracts_law') AND pathway_slug IS NULL;
UPDATE academy_resources SET pathway_slug = 'digital-construction' WHERE category IN ('technology') AND pathway_slug IS NULL;
UPDATE academy_resources SET pathway_slug = 'project-management' WHERE category = 'career' AND pathway_slug IS NULL;
UPDATE academy_resources SET pathway_slug = 'academic-research' WHERE category = 'exam_prep' AND pathway_slug IS NULL;

-- RLS policies for academy_modules
ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_modules_read" ON academy_modules
  FOR SELECT USING (is_published = true);

CREATE POLICY "academy_modules_manage_admin" ON academy_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND org_role = 'super_admin')
  );
