-- Migration 047: Add display metadata columns to exam_definitions
-- and seed professional exam display data so frontend can drop hardcoded arrays

-- Add display metadata columns
ALTER TABLE exam_definitions ADD COLUMN IF NOT EXISTS body text DEFAULT '';
ALTER TABLE exam_definitions ADD COLUMN IF NOT EXISTS format text DEFAULT '';
ALTER TABLE exam_definitions ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'Intermediate';
ALTER TABLE exam_definitions ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}';

-- Seed display metadata for professional exams (matches existing exam_definitions by exam_name)
-- Nigerian Professional
UPDATE exam_definitions SET
  body = 'QSRBN', format = '50 MCQs', difficulty = 'Intermediate',
  topics = ARRAY['Construction Law & Regulations', 'Standard Method of Measurement (SMM7)', 'BOQ Preparation', 'Professional Ethics', 'Nigerian Building Code', 'Contract Administration']
WHERE exam_name ILIKE '%QSRBN%Registration%' AND category = 'nigerian_professional';

UPDATE exam_definitions SET
  body = 'NIQS', format = '40 MCQs + 10 Short Answers', difficulty = 'Intermediate',
  topics = ARRAY['Elementary Measurement', 'BOQ Production', 'Cost Estimation', 'Building Technology', 'Construction Materials', 'Professional Practice']
WHERE exam_name ILIKE '%NIQS%Probation%' AND category = 'nigerian_professional';

UPDATE exam_definitions SET
  body = 'NIQS', format = '30 MCQs + 5 Long Questions', difficulty = 'Advanced',
  topics = ARRAY['Advanced Measurement', 'Cost Planning & Control', 'Value Engineering', 'Project Management', 'Construction Economics', 'Contractual Procedures']
WHERE exam_name ILIKE '%NIQS%Intermediate%' AND category = 'nigerian_professional';

UPDATE exam_definitions SET
  body = 'NIQS', format = '6 Papers', difficulty = 'Advanced',
  topics = ARRAY['Measurement & Quantification', 'Construction Technology', 'Professional Practice', 'Construction Economics', 'Contract Administration', 'Project Management']
WHERE exam_name ILIKE '%NIQS%GDE%' AND category = 'nigerian_professional';

UPDATE exam_definitions SET
  body = 'NIQS', format = '4 Papers', difficulty = 'Expert',
  topics = ARRAY['Case Study Analysis', 'Professional Ethics', 'Dispute Resolution', 'Construction Management', 'Cost consultancy', 'Client Advisory']
WHERE exam_name ILIKE '%NIQS%TPC%' AND category = 'nigerian_professional';

UPDATE exam_definitions SET
  body = 'NIQS', format = 'Mock Interview Format', difficulty = 'Expert',
  topics = ARRAY['Professional Interview Technique', 'Case Study Presentation', 'Ethical Scenarios', 'Client Communication', 'Team Leadership']
WHERE exam_name ILIKE '%NIQS%PCI%' AND category = 'nigerian_professional';

UPDATE exam_definitions SET
  body = 'General', format = '30 MCQs + 10 Scenarios', difficulty = 'All Levels',
  topics = ARRAY['Technical Knowledge', 'Situational Judgment', 'CV & Portfolio', 'Salary Negotiation', 'Industry Knowledge', 'Soft Skills']
WHERE exam_name ILIKE '%Job%Interview%' AND category = 'nigerian_professional';

-- International
UPDATE exam_definitions SET
  body = 'RICS', format = '50 MCQs per Competency', difficulty = 'Advanced',
  topics = ARRAY['Client Care', 'People & Communication', 'Construction Technology', 'Contract Practice', 'Financial Control', 'Professional Judgment']
WHERE exam_name ILIKE '%RICS%APC%' AND category = 'international';

UPDATE exam_definitions SET
  body = 'CIOB', format = '40 MCQs + Case Studies', difficulty = 'Advanced',
  topics = ARRAY['Construction Management', 'Building Technology', 'Health & Safety', 'Sustainability', 'Leadership', 'Contract Administration']
WHERE exam_name ILIKE '%CIOB%Chartered%' AND category = 'international';

UPDATE exam_definitions SET
  body = 'PMI', format = '180 MCQs across 3 Sections', difficulty = 'Expert',
  topics = ARRAY['People', 'Process', 'Business Environment', 'Agile Methodologies', 'Risk Management', 'Stakeholder Engagement']
WHERE exam_name ILIKE '%PMP%' AND category = 'international';

UPDATE exam_definitions SET
  body = 'Axelos', format = '75 MCQs', difficulty = 'Intermediate',
  topics = ARRAY['Principles', 'Themes', 'Processes', 'Project Environment', 'Tailoring', 'Roles & Responsibilities']
WHERE exam_name ILIKE '%PRINCE2%Foundation%' AND category = 'international';

UPDATE exam_definitions SET
  body = 'Axelos', format = 'Objective Testing', difficulty = 'Advanced',
  topics = ARRAY['Application of Principles', 'Tailoring Themes', 'Adapting Processes', 'Project Scenarios', 'Lesson Application', 'Commercial Management']
WHERE exam_name ILIKE '%PRINCE2%Practitioner%' AND category = 'international';

-- Add slug column
ALTER TABLE exam_definitions ADD COLUMN IF NOT EXISTS slug text;

-- Drop old index if it exists (may have been created with bad slugs)
DROP INDEX IF EXISTS idx_exam_def_slug;

-- Reset all slugs and re-seed with guaranteed unique format (full UUID suffix)
UPDATE exam_definitions SET slug = NULL;
UPDATE exam_definitions SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(exam_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
  || '-' || REPLACE(id::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_def_slug ON exam_definitions(slug) WHERE slug IS NOT NULL;
