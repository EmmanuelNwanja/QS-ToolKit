-- ============================================================
--  QSToolkit - BOQ QS Compliance Upgrade
--  Adds standards compliance, preliminaries typing, and
--  structured specification fields for BOQ items.
-- ============================================================

-- 1) Measurement standards at project/BOQ level
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS measurement_standard VARCHAR(10);

ALTER TABLE boq_documents
  ADD COLUMN IF NOT EXISTS measurement_standard VARCHAR(10);

ALTER TABLE projects
  ADD CONSTRAINT projects_measurement_standard_chk
  CHECK (measurement_standard IN ('SMM7', 'NRM2'));

ALTER TABLE boq_documents
  ADD CONSTRAINT boq_documents_measurement_standard_chk
  CHECK (measurement_standard IN ('SMM7', 'NRM2'));

-- 2) BOQ section typing for structured layouts
ALTER TABLE boq_sections
  ADD COLUMN IF NOT EXISTS section_type VARCHAR(30) DEFAULT 'measured_work';

ALTER TABLE boq_sections
  ADD CONSTRAINT boq_sections_section_type_chk
  CHECK (section_type IN ('preliminaries', 'measured_work', 'provisional_sum', 'dayworks'));

-- 3) BOQ item classification and detailed specifications
ALTER TABLE boq_items
  ADD COLUMN IF NOT EXISTS cost_class VARCHAR(30) DEFAULT 'measured_work',
  ADD COLUMN IF NOT EXISTS is_preliminary BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS thickness_or_mix VARCHAR(120),
  ADD COLUMN IF NOT EXISTS finish_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS spec_reference VARCHAR(120);

ALTER TABLE boq_items
  ADD CONSTRAINT boq_items_cost_class_chk
  CHECK (cost_class IN ('preliminaries', 'measured_work', 'provisional_sum', 'dayworks'));

-- 4) Optional preliminaries templates for new BOQs
CREATE TABLE IF NOT EXISTS boq_prelim_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(30) DEFAULT 'item',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO boq_prelim_template_items (title, description, unit, sort_order)
VALUES
  ('Site Setup', 'Site setup and mobilization, including temporary offices and welfare.', 'item', 0),
  ('Temporary Works', 'Temporary works, supports, access, and protection measures.', 'item', 1),
  ('Supervision', 'Project supervision and site management staff provisions.', 'item', 2),
  ('Security', 'Site security personnel, controls, and perimeter arrangements.', 'item', 3)
ON CONFLICT DO NOTHING;
