-- Migration 032: Visual Primitives for Auto-BOQ
-- Enables spatial reasoning with bounding boxes, polygons, points, and lines
-- for precise visual grounding in architectural drawing analysis.

-- ─── Visual Primitive Annotations ─────────────────────────────

CREATE TABLE drawing_primitive_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  drawing_analysis_job_id uuid REFERENCES drawing_analysis_jobs(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  drawing_type text NOT NULL DEFAULT 'floor_plan' CHECK (drawing_type IN ('floor_plan', 'elevation', 'section', 'site_plan')),
  primitives jsonb NOT NULL DEFAULT '[]',
    -- Array of { type, id, coords, label, confidence, roomId?, metadata? }
  reasoning text,
  query text,
  suggested_boq jsonb DEFAULT '[]',
    -- Array of suggested BOQ sections with items
  measurements jsonb DEFAULT '{}',
    -- { totalBuiltUpArea, totalWallArea, estimatedConcreteVolume }
  model_version text DEFAULT 'gemini-2.5-pro-exp-03-25',
  confidence text DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  avg_primitive_confidence numeric(3,2) CHECK (avg_primitive_confidence >= 0 AND avg_primitive_confidence <= 1),
  validated_by_user boolean DEFAULT false,
  user_corrections jsonb DEFAULT '[]',
    -- Array of { primitiveId, correctionType, original, corrected, timestamp }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dpa_project ON drawing_primitive_annotations(project_id);
CREATE INDEX idx_dpa_job ON drawing_primitive_annotations(drawing_analysis_job_id);
CREATE INDEX idx_dpa_drawing_type ON drawing_primitive_annotations(drawing_type);
CREATE INDEX idx_dpa_created ON drawing_primitive_annotations(created_at DESC);

-- ─── Drawing Primitive Feedback (Learning Loop) ───────────────

CREATE TABLE drawing_primitive_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid REFERENCES drawing_primitive_annotations(id) ON DELETE CASCADE,
  correction_type text NOT NULL CHECK (correction_type IN (
    'missed_room', 'false_room', 'dimension_error', 'boundary_error',
    'label_error', 'missing_element', 'wrong_element_type', 'confidence_adjustment'
  )),
  primitive_id text,
  original_primitive jsonb,
  corrected_primitive jsonb,
  user_notes text,
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dpf_annotation ON drawing_primitive_feedback(annotation_id);
CREATE INDEX idx_dpf_correction_type ON drawing_primitive_feedback(correction_type);
CREATE INDEX idx_dpf_user ON drawing_primitive_feedback(user_id);
CREATE INDEX idx_dpf_created ON drawing_primitive_feedback(created_at DESC);

-- ─── Visual Primitive Accuracy Aggregates (for Self-Improvement) ─

CREATE VIEW drawing_primitive_accuracy AS
SELECT
  dpa.drawing_type,
  dpa.model_version,
  COUNT(DISTINCT dpa.id) AS total_annotations,
  COUNT(DISTINCT CASE WHEN dpa.validated_by_user THEN dpa.id END) AS validated_count,
  COUNT(DISTINCT dpf.id) AS total_corrections,
  COUNT(DISTINCT CASE WHEN dpf.correction_type = 'missed_room' THEN dpf.id END) AS missed_rooms,
  COUNT(DISTINCT CASE WHEN dpf.correction_type = 'false_room' THEN dpf.id END) AS false_rooms,
  COUNT(DISTINCT CASE WHEN dpf.correction_type = 'dimension_error' THEN dpf.id END) AS dimension_errors,
  COUNT(DISTINCT CASE WHEN dpf.correction_type = 'boundary_error' THEN dpf.id END) AS boundary_errors,
  ROUND(
    (COUNT(DISTINCT dpa.id) - COUNT(DISTINCT dpf.id))::numeric /
    NULLIF(COUNT(DISTINCT dpa.id), 0) * 100,
    2
  ) AS accuracy_pct
FROM drawing_primitive_annotations dpa
LEFT JOIN drawing_primitive_feedback dpf ON dpa.id = dpf.annotation_id
GROUP BY dpa.drawing_type, dpa.model_version;

-- ─── Updated At Trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dpa_updated_at
  BEFORE UPDATE ON drawing_primitive_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
