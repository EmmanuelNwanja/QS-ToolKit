-- ================================================================
-- Migration 035: Parametric Schema v2
--   - Refined typology hierarchy (4 beams, 3 slabs, 2 columns)
--   - Consolidated rule_config JSON per (typology, standard_code)
--   - parametric_calculations table with project & estimate FKs
--   - Enhanced calculation_audits with overrides tracking
--   - Full seed data: 9 typologies × 4 standards × rule_config
-- ================================================================
-- NOTE: No estimates table exists in this codebase.
--       estimate_id references boq_documents (the estimation layer).
-- ================================================================

-- ================================================================
-- PART 1: ENHANCE element_typologies
-- ================================================================

-- 1a. Add new columns to existing typologies table
ALTER TABLE element_typologies
  ADD COLUMN IF NOT EXISTS category    TEXT,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS parent_id   UUID REFERENCES element_typologies(id);

-- 1b. Populate name from existing element_type
UPDATE element_typologies SET name = element_type WHERE name IS NULL;

-- 1c. Assign categories to existing entries
UPDATE element_typologies SET category = 'beam'       WHERE element_type IN ('beam', 'curved_beam');
UPDATE element_typologies SET category = 'column'     WHERE element_type IN ('column', 'circular_column');
UPDATE element_typologies SET category = 'slab'       WHERE element_type = 'slab';
UPDATE element_typologies SET category = 'foundation' WHERE element_type = 'footing';
UPDATE element_typologies SET category = 'wall'       WHERE element_type = 'wall';
UPDATE element_typologies SET category = 'stair'      WHERE element_type = 'staircase';
UPDATE element_typologies SET category = 'shell'      WHERE element_type = 'dome_shell';

-- 1d. Mark generic typologies as inactive
UPDATE element_typologies SET is_active = false
WHERE element_type IN ('beam', 'column', 'slab', 'footing', 'wall');

-- 1e. Insert refined beam typologies
INSERT INTO element_typologies (element_type, name, category, label, icon, description, default_standard, is_active)
VALUES
  ('beam_simply_supported', 'Simply Supported Beam', 'beam',
   'Simply Supported Beam', '🏗️',
   'Beam resting on supports at both ends with free rotation', 'eurocode', true),
  ('beam_continuous',       'Continuous Beam',       'beam',
   'Continuous Beam',       '🏗️',
   'Beam spanning over three or more supports in a continuous line', 'eurocode', true),
  ('beam_cantilever',       'Cantilever Beam',       'beam',
   'Cantilever Beam',       '🏗️',
   'Beam fixed at one end and free at the other', 'eurocode', true),
  ('beam_deep',             'Deep Beam',              'beam',
   'Deep Beam',             '🏗️',
   'Deep beam with span/depth ratio ≤ 4, governed by strut-and-tie', 'eurocode', true)
ON CONFLICT (element_type) DO NOTHING;

-- 1f. Insert refined slab typologies
INSERT INTO element_typologies (element_type, name, category, label, icon, description, default_standard, is_active)
VALUES
  ('slab_one_way', 'One-Way Slab',  'slab',
   'One-Way Slab',  '🏢',
   'Slab spanning in one direction, supported on two opposite sides', 'eurocode', true),
  ('slab_two_way', 'Two-Way Slab',  'slab',
   'Two-Way Slab',  '🏢',
   'Slab spanning in two perpendicular directions', 'eurocode', true),
  ('slab_flat',     'Flat Slab',     'slab',
   'Flat Slab',     '🏢',
   'Slab supported directly on columns without beams (drop panels optional)', 'eurocode', true)
ON CONFLICT (element_type) DO NOTHING;

-- 1g. Insert refined column typologies
INSERT INTO element_typologies (element_type, name, category, label, icon, description, default_standard, is_active)
VALUES
  ('column_axial',   'Axially Loaded Column',   'column',
   'Axial Column',   '🏛️',
   'Column primarily under axial compression with negligible moment', 'eurocode', true),
  ('column_biaxial', 'Bi-Axially Loaded Column', 'column',
   'Biaxial Column', '🏛️',
   'Column under axial load with significant bi-axial bending', 'eurocode', true)
ON CONFLICT (element_type) DO NOTHING;

-- 1h. Make name NOT NULL once populated
ALTER TABLE element_typologies ALTER COLUMN name SET NOT NULL;


-- ================================================================
-- PART 2: ENHANCE parametric_rules
-- ================================================================

ALTER TABLE parametric_rules
  ADD COLUMN IF NOT EXISTS typology_id    UUID REFERENCES element_typologies(id),
  ADD COLUMN IF NOT EXISTS standard_code  TEXT,
  ADD COLUMN IF NOT EXISTS rule_config    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true;

-- Populate standard_code from existing standard column
UPDATE parametric_rules SET standard_code = standard WHERE standard_code IS NULL AND standard IS NOT NULL;

-- ================================================================
-- PART 3: CREATE parametric_calculations table
-- ================================================================

CREATE TABLE IF NOT EXISTS parametric_calculations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id       UUID REFERENCES boq_documents(id) ON DELETE SET NULL,
  typology_id       UUID NOT NULL REFERENCES element_typologies(id),
  standard_code     TEXT NOT NULL,
  inputs            JSONB NOT NULL DEFAULT '{}',
  derived_dimensions JSONB NOT NULL DEFAULT '{}',
  quantities        JSONB NOT NULL DEFAULT '{}',
  cascade           JSONB DEFAULT '{}',
  audit_log         JSONB DEFAULT '[]',
  user_overrides    JSONB DEFAULT '{}',
  warnings          JSONB DEFAULT '[]',
  waste_factors     JSONB DEFAULT '{}',
  session_label     TEXT,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- PART 4: ENHANCE calculation_audits
-- ================================================================

ALTER TABLE calculation_audits
  ADD COLUMN IF NOT EXISTS calculation_id UUID REFERENCES parametric_calculations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rule_applied   TEXT,
  ADD COLUMN IF NOT EXISTS standard_reference TEXT,
  ADD COLUMN IF NOT EXISTS assumption     TEXT,
  ADD COLUMN IF NOT EXISTS auto_value     NUMERIC,
  ADD COLUMN IF NOT EXISTS final_value    NUMERIC,
  ADD COLUMN IF NOT EXISTS is_overridden  BOOLEAN DEFAULT false;

-- Populate new columns from old for backward compat
UPDATE calculation_audits
  SET rule_applied = rule_name,
      auto_value = computed_value,
      final_value = computed_value,
      is_overridden = false
  WHERE rule_applied IS NULL;


-- ================================================================
-- PART 5: SEED rule_config data for new typologies × 4 standards
-- ================================================================

-- ---------------------------------------------------------------
-- 5a. BEAM — Simply Supported
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('beam_simply_supported', 'eurocode', 'EC2', 'Beam Simply Supported — Eurocode 2', 'EC2 Simply Supported Beam', 'Eurocode 2 Table 7.4N', 'Span/overall-depth ratio for simply supported beams', 'h ≥ span / 10',
   '{"ratio": 10, "min_depth_mm": 200}',
   '{"span_depth_ratio": 10, "width_depth_ratio": 0.4, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 120, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 200, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10),
  ('beam_simply_supported', 'aci318', 'ACI 318', 'Beam Simply Supported — ACI 318', 'ACI 318 Simply Supported Beam', 'ACI 318 Table 9.3.1.1', 'Minimum depth/span for simply supported beams', 'h ≥ span / 16',
   '{"ratio": 16, "min_depth_mm": 200}',
   '{"span_depth_ratio": 16, "width_depth_ratio": 0.57, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 40, "reinf_density_kg_per_m3": 130, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 220, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10),
  ('beam_simply_supported', 'is456', 'IS 456', 'Beam Simply Supported — IS 456', 'IS 456 Simply Supported Beam', 'IS 456 Cl. 23.2.1', 'Minimum depth/span for simply supported beams', 'h ≥ span / 12',
   '{"ratio": 12, "min_depth_mm": 200}',
   '{"span_depth_ratio": 12, "width_depth_ratio": 0.44, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 120, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 200, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10),
  ('beam_simply_supported', 'bs8110', 'BS 8110', 'Beam Simply Supported — BS 8110', 'BS 8110 Simply Supported Beam', 'BS 8110 Table 3.9', 'Minimum depth/span ratio', 'h ≥ span / 12',
   '{"ratio": 12, "min_depth_mm": 200}',
   '{"span_depth_ratio": 12, "width_depth_ratio": 0.4, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 115, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 190, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5b. BEAM — Continuous
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('beam_continuous', 'eurocode', 'EC2', 'Beam Continuous — Eurocode 2', 'EC2 Continuous Beam', 'Eurocode 2 Table 7.4N', 'Span/overall-depth ratio for continuous beams', 'h ≥ span / 12',
   '{"ratio": 12, "min_depth_mm": 200}',
   '{"span_depth_ratio": 12, "width_depth_ratio": 0.4, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 120, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 200, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10),
  ('beam_continuous', 'aci318', 'ACI 318', 'Beam Continuous — ACI 318', 'ACI 318 Continuous Beam', 'ACI 318 Table 9.3.1.1', 'Minimum depth/span for continuous beams', 'h ≥ span / 21',
   '{"ratio": 21, "min_depth_mm": 200}',
   '{"span_depth_ratio": 21, "width_depth_ratio": 0.57, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 40, "reinf_density_kg_per_m3": 130, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 220, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10),
  ('beam_continuous', 'is456', 'IS 456', 'Beam Continuous — IS 456', 'IS 456 Continuous Beam', 'IS 456 Cl. 23.2.1', 'Minimum depth/span for continuous beams', 'h ≥ span / 15',
   '{"ratio": 15, "min_depth_mm": 200}',
   '{"span_depth_ratio": 15, "width_depth_ratio": 0.44, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 120, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 200, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10),
  ('beam_continuous', 'bs8110', 'BS 8110', 'Beam Continuous — BS 8110', 'BS 8110 Continuous Beam', 'BS 8110 Table 3.9', 'Minimum depth/span for continuous', 'h ≥ span / 15',
   '{"ratio": 15, "min_depth_mm": 200}',
   '{"span_depth_ratio": 15, "width_depth_ratio": 0.4, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 115, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 190, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": true, "soffit_included": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5c. BEAM — Cantilever
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('beam_cantilever', 'eurocode', 'EC2', 'Beam Cantilever — Eurocode 2', 'EC2 Cantilever Beam', 'Eurocode 2 Table 7.4N', 'Span/overall-depth ratio for cantilevers', 'h ≥ span / 7',
   '{"ratio": 7, "min_depth_mm": 200}',
   '{"span_depth_ratio": 7, "width_depth_ratio": 0.4, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 130, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 250, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10),
  ('beam_cantilever', 'aci318', 'ACI 318', 'Beam Cantilever — ACI 318', 'ACI 318 Cantilever Beam', 'ACI 318 Table 9.3.1.1', 'Minimum depth/span for cantilevers', 'h ≥ span / 8',
   '{"ratio": 8, "min_depth_mm": 200}',
   '{"span_depth_ratio": 8, "width_depth_ratio": 0.57, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 40, "reinf_density_kg_per_m3": 140, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 280, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10),
  ('beam_cantilever', 'is456', 'IS 456', 'Beam Cantilever — IS 456', 'IS 456 Cantilever Beam', 'IS 456 Cl. 23.2.1', 'Minimum depth/span for cantilevers', 'h ≥ span / 7',
   '{"ratio": 7, "min_depth_mm": 200}',
   '{"span_depth_ratio": 7, "width_depth_ratio": 0.44, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 130, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 250, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10),
  ('beam_cantilever', 'bs8110', 'BS 8110', 'Beam Cantilever — BS 8110', 'BS 8110 Cantilever Beam', 'BS 8110 Table 3.9', 'Minimum depth/span for cantilevers', 'h ≥ span / 7',
   '{"ratio": 7, "min_depth_mm": 200}',
   '{"span_depth_ratio": 7, "width_depth_ratio": 0.4, "min_width_mm": 150, "min_depth_mm": 200, "modular_step_mm": 25, "cover_mm": 30, "reinf_density_kg_per_m3": 125, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 240, "deflection_check": true, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5d. BEAM — Deep Beam
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('beam_deep', 'eurocode', 'EC2', 'Deep Beam — Eurocode 2', 'EC2 Deep Beam', 'Eurocode 2 Cl. 5.3.1', 'Deep beam with L/h ≤ 4, strut-and-tie design', 'h ≥ span / 4, min web width = 200',
   '{"max_slenderness": 4, "min_web_width_mm": 200}',
   '{"span_depth_ratio": 4, "width_depth_ratio": 0.3, "min_width_mm": 200, "min_depth_mm": 400, "modular_step_mm": 25, "cover_mm": 35, "reinf_density_kg_per_m3": 140, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 300, "deflection_check": false, "dominant_mode": "shear", "max_slenderness": 4, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10),
  ('beam_deep', 'aci318', 'ACI 318', 'Deep Beam — ACI 318', 'ACI 318 Deep Beam', 'ACI 318 Cl. 9.9.1.1', 'Deep beam with Ln/h ≤ 4', 'h ≥ span / 4, min web = 200mm',
   '{"max_slenderness": 4, "min_web_width_mm": 200}',
   '{"span_depth_ratio": 4, "width_depth_ratio": 0.4, "min_width_mm": 200, "min_depth_mm": 400, "modular_step_mm": 25, "cover_mm": 40, "reinf_density_kg_per_m3": 150, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 350, "deflection_check": false, "dominant_mode": "shear", "max_slenderness": 4, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10),
  ('beam_deep', 'is456', 'IS 456', 'Deep Beam — IS 456', 'IS 456 Deep Beam', 'IS 456 Cl. 29.1', 'Deep beam with L/D ≤ 2 for simply supported', 'h ≥ span / 2, min web = 200mm',
   '{"max_slenderness": 2, "min_web_width_mm": 200}',
   '{"span_depth_ratio": 2, "width_depth_ratio": 0.3, "min_width_mm": 200, "min_depth_mm": 500, "modular_step_mm": 25, "cover_mm": 35, "reinf_density_kg_per_m3": 150, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 350, "deflection_check": false, "dominant_mode": "shear", "max_slenderness": 2, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10),
  ('beam_deep', 'bs8110', 'BS 8110', 'Deep Beam — BS 8110', 'BS 8110 Deep Beam', 'BS 8110 Cl. 3.4.5.1', 'Deep beam with span/depth ≤ 4', 'h ≥ span / 4, min web = 200mm',
   '{"max_slenderness": 4, "min_web_width_mm": 200}',
   '{"span_depth_ratio": 4, "width_depth_ratio": 0.35, "min_width_mm": 200, "min_depth_mm": 400, "modular_step_mm": 25, "cover_mm": 35, "reinf_density_kg_per_m3": 140, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 300, "deflection_check": false, "dominant_mode": "shear", "max_slenderness": 4, "formwork": {"exclude_top": true, "sides_only_lateral": false, "soffit_included": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5e. SLAB — One-Way
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('slab_one_way', 'eurocode', 'EC2', 'One-Way Slab — Eurocode 2', 'EC2 One-Way Slab', 'Eurocode 2 Cl. 7.4.1', 'Min thickness for one-way spanning slab', 'h ≥ span / 30',
   '{"ratio": 30, "min_thickness_mm": 120}',
   '{"span_depth_ratio": 30, "min_thickness_mm": 120, "cover_mm": 25, "reinf_density_kg_per_m3": 100, "reinf_min_kg_per_m3": 60, "reinf_max_kg_per_m3": 160, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_one_way', 'aci318', 'ACI 318', 'One-Way Slab — ACI 318', 'ACI 318 One-Way Slab', 'ACI 318 Table 7.3.1.1', 'Min thickness for one-way slab', 'h ≥ span / 20',
   '{"ratio": 20, "min_thickness_mm": 125}',
   '{"span_depth_ratio": 20, "min_thickness_mm": 125, "cover_mm": 20, "reinf_density_kg_per_m3": 110, "reinf_min_kg_per_m3": 60, "reinf_max_kg_per_m3": 180, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_one_way', 'is456', 'IS 456', 'One-Way Slab — IS 456', 'IS 456 One-Way Slab', 'IS 456 Cl. 24.1', 'Min thickness for one-way slab', 'h ≥ span / 30',
   '{"ratio": 30, "min_thickness_mm": 100}',
   '{"span_depth_ratio": 30, "min_thickness_mm": 100, "cover_mm": 20, "reinf_density_kg_per_m3": 90, "reinf_min_kg_per_m3": 50, "reinf_max_kg_per_m3": 150, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_one_way', 'bs8110', 'BS 8110', 'One-Way Slab — BS 8110', 'BS 8110 One-Way Slab', 'BS 8110 Table 3.9', 'Min thickness for one-way slab', 'h ≥ span / 30',
   '{"ratio": 30, "min_thickness_mm": 100}',
   '{"span_depth_ratio": 30, "min_thickness_mm": 100, "cover_mm": 20, "reinf_density_kg_per_m3": 95, "reinf_min_kg_per_m3": 50, "reinf_max_kg_per_m3": 160, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5f. SLAB — Two-Way
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('slab_two_way', 'eurocode', 'EC2', 'Two-Way Slab — Eurocode 2', 'EC2 Two-Way Slab', 'Eurocode 2 Cl. 7.4.1', 'Min thickness for two-way spanning slab', 'h ≥ span / 35',
   '{"ratio": 35, "min_thickness_mm": 120}',
   '{"span_depth_ratio": 35, "min_thickness_mm": 120, "cover_mm": 25, "reinf_density_kg_per_m3": 100, "reinf_min_kg_per_m3": 60, "reinf_max_kg_per_m3": 160, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_two_way', 'aci318', 'ACI 318', 'Two-Way Slab — ACI 318', 'ACI 318 Two-Way Slab', 'ACI 318 Table 7.3.1.1', 'Min thickness for two-way slab', 'h ≥ span / 24',
   '{"ratio": 24, "min_thickness_mm": 125}',
   '{"span_depth_ratio": 24, "min_thickness_mm": 125, "cover_mm": 20, "reinf_density_kg_per_m3": 110, "reinf_min_kg_per_m3": 60, "reinf_max_kg_per_m3": 180, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_two_way', 'is456', 'IS 456', 'Two-Way Slab — IS 456', 'IS 456 Two-Way Slab', 'IS 456 Cl. 24.1', 'Min thickness for two-way slab', 'h ≥ span / 35',
   '{"ratio": 35, "min_thickness_mm": 100}',
   '{"span_depth_ratio": 35, "min_thickness_mm": 100, "cover_mm": 20, "reinf_density_kg_per_m3": 90, "reinf_min_kg_per_m3": 50, "reinf_max_kg_per_m3": 150, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_two_way', 'bs8110', 'BS 8110', 'Two-Way Slab — BS 8110', 'BS 8110 Two-Way Slab', 'BS 8110 Table 3.9', 'Min thickness for two-way slab', 'h ≥ span / 35',
   '{"ratio": 35, "min_thickness_mm": 100}',
   '{"span_depth_ratio": 35, "min_thickness_mm": 100, "cover_mm": 20, "reinf_density_kg_per_m3": 95, "reinf_min_kg_per_m3": 50, "reinf_max_kg_per_m3": 160, "deflection_check": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5g. SLAB — Flat Slab
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('slab_flat', 'eurocode', 'EC2', 'Flat Slab — Eurocode 2', 'EC2 Flat Slab', 'Eurocode 2 Cl. 7.4.1', 'Min thickness for flat slab', 'h ≥ span / 28',
   '{"ratio": 28, "min_thickness_mm": 150}',
   '{"span_depth_ratio": 28, "min_thickness_mm": 150, "cover_mm": 25, "reinf_density_kg_per_m3": 110, "reinf_min_kg_per_m3": 70, "reinf_max_kg_per_m3": 180, "deflection_check": true, "punching_shear_check": true, "drop_panel_optional": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_flat', 'aci318', 'ACI 318', 'Flat Slab — ACI 318', 'ACI 318 Flat Slab', 'ACI 318 Table 7.3.1.1', 'Min thickness for flat slab (without drop panels)', 'h ≥ span / 30 for exterior panels',
   '{"ratio": 30, "min_thickness_mm": 150}',
   '{"span_depth_ratio": 30, "min_thickness_mm": 150, "cover_mm": 20, "reinf_density_kg_per_m3": 120, "reinf_min_kg_per_m3": 70, "reinf_max_kg_per_m3": 200, "deflection_check": true, "punching_shear_check": true, "drop_panel_optional": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_flat', 'is456', 'IS 456', 'Flat Slab — IS 456', 'IS 456 Flat Slab', 'IS 456 Cl. 24.1', 'Min thickness for flat slab', 'h ≥ span / 28',
   '{"ratio": 28, "min_thickness_mm": 125}',
   '{"span_depth_ratio": 28, "min_thickness_mm": 125, "cover_mm": 20, "reinf_density_kg_per_m3": 100, "reinf_min_kg_per_m3": 60, "reinf_max_kg_per_m3": 170, "deflection_check": true, "punching_shear_check": true, "drop_panel_optional": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10),
  ('slab_flat', 'bs8110', 'BS 8110', 'Flat Slab — BS 8110', 'BS 8110 Flat Slab', 'BS 8110 Table 3.9', 'Min thickness for flat slab', 'h ≥ span / 28',
   '{"ratio": 28, "min_thickness_mm": 125}',
   '{"span_depth_ratio": 28, "min_thickness_mm": 125, "cover_mm": 20, "reinf_density_kg_per_m3": 105, "reinf_min_kg_per_m3": 60, "reinf_max_kg_per_m3": 170, "deflection_check": true, "punching_shear_check": true, "drop_panel_optional": true, "formwork": {"soffit_included": true, "edge_shuttering_included": true, "top_excluded": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5h. COLUMN — Axially Loaded
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('column_axial', 'eurocode', 'EC2', 'Axial Column — Eurocode 2', 'EC2 Axial Column', 'Eurocode 2 Cl. 5.3.1', 'Min column section for axial compression', 'b ≥ 230mm, h ≥ 230mm',
   '{"min_mm": 230}',
   '{"min_size_mm": 230, "height_ratio_min": 10, "height_ratio_max": 15, "cover_mm": 30, "reinf_density_kg_per_m3": 150, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 250, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10),
  ('column_axial', 'aci318', 'ACI 318', 'Axial Column — ACI 318', 'ACI 318 Axial Column', 'ACI 318 Cl. 10.3.5', 'Min column dimension for axial', 'b ≥ 250mm',
   '{"min_mm": 250}',
   '{"min_size_mm": 250, "height_ratio_min": 8, "height_ratio_max": 12, "cover_mm": 40, "reinf_density_kg_per_m3": 160, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 280, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10),
  ('column_axial', 'is456', 'IS 456', 'Axial Column — IS 456', 'IS 456 Axial Column', 'IS 456 Cl. 25.3.1', 'Min column dimension for axial', 'b ≥ 200mm',
   '{"min_mm": 200}',
   '{"min_size_mm": 200, "height_ratio_min": 10, "height_ratio_max": 15, "cover_mm": 30, "reinf_density_kg_per_m3": 140, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 240, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10),
  ('column_axial', 'bs8110', 'BS 8110', 'Axial Column — BS 8110', 'BS 8110 Axial Column', 'BS 8110 Cl. 3.12.5.3', 'Min column dimension', 'b ≥ 200mm',
   '{"min_mm": 200}',
   '{"min_size_mm": 200, "height_ratio_min": 10, "height_ratio_max": 15, "cover_mm": 30, "reinf_density_kg_per_m3": 140, "reinf_min_kg_per_m3": 80, "reinf_max_kg_per_m3": 250, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;

-- ---------------------------------------------------------------
-- 5i. COLUMN — Bi-Axially Loaded
-- ---------------------------------------------------------------
WITH tid AS (SELECT id, element_type FROM element_typologies)
INSERT INTO parametric_rules (typology_id, element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority, is_active)
SELECT
  t.id, t.element_type, src.standard, src.standard_code, src.rule_name, src.display_label, src.code_reference, src.description, src.formula, src.parameters, src.rule_config::jsonb, src.severity, src.priority, true
FROM tid t, (VALUES
  ('column_biaxial', 'eurocode', 'EC2', 'Biaxial Column — Eurocode 2', 'EC2 Biaxial Column', 'Eurocode 2 Cl. 5.8.9', 'Column with bi-axial bending — increased size', 'b ≥ 250mm, h ≥ 250mm (10% increase over axial)',
   '{"min_mm": 250}',
   '{"min_size_mm": 250, "height_ratio_min": 8, "height_ratio_max": 12, "cover_mm": 30, "reinf_density_kg_per_m3": 180, "reinf_min_kg_per_m3": 120, "reinf_max_kg_per_m3": 300, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "biaxial_amplification": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10),
  ('column_biaxial', 'aci318', 'ACI 318', 'Biaxial Column — ACI 318', 'ACI 318 Biaxial Column', 'ACI 318 Cl. 6.6.5', 'Column with bi-axial bending', 'b ≥ 300mm',
   '{"min_mm": 300}',
   '{"min_size_mm": 300, "height_ratio_min": 7, "height_ratio_max": 11, "cover_mm": 40, "reinf_density_kg_per_m3": 190, "reinf_min_kg_per_m3": 120, "reinf_max_kg_per_m3": 320, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "biaxial_amplification": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10),
  ('column_biaxial', 'is456', 'IS 456', 'Biaxial Column — IS 456', 'IS 456 Biaxial Column', 'IS 456 Cl. 39.6', 'Column with bi-axial bending per SP 16', 'b ≥ 230mm',
   '{"min_mm": 230}',
   '{"min_size_mm": 230, "height_ratio_min": 8, "height_ratio_max": 13, "cover_mm": 30, "reinf_density_kg_per_m3": 170, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 280, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "biaxial_amplification": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10),
  ('column_biaxial', 'bs8110', 'BS 8110', 'Biaxial Column — BS 8110', 'BS 8110 Biaxial Column', 'BS 8110 Cl. 3.8.4.2', 'Column with bi-axial bending', 'b ≥ 230mm',
   '{"min_mm": 230}',
   '{"min_size_mm": 230, "height_ratio_min": 8, "height_ratio_max": 13, "cover_mm": 30, "reinf_density_kg_per_m3": 170, "reinf_min_kg_per_m3": 100, "reinf_max_kg_per_m3": 280, "min_longitudinal_bars": 4, "max_aggregate_size_mm": 20, "slenderness_check": true, "biaxial_amplification": true, "formwork": {"perimeter_formwork": true, "top_excluded": true}}', 'mandatory', 10)
) AS src(element_type, standard, standard_code, rule_name, display_label, code_reference, description, formula, parameters, rule_config, severity, priority)
WHERE t.element_type = src.element_type;


-- ================================================================
-- PART 6: INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_parametric_calculations_project
  ON parametric_calculations(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parametric_calculations_estimate
  ON parametric_calculations(estimate_id);
CREATE INDEX IF NOT EXISTS idx_parametric_calculations_typology
  ON parametric_calculations(typology_id);
CREATE INDEX IF NOT EXISTS idx_parametric_calculations_standard
  ON parametric_calculations(standard_code);
CREATE INDEX IF NOT EXISTS idx_parametric_calculations_created_by
  ON parametric_calculations(created_by);
CREATE INDEX IF NOT EXISTS idx_parametric_rules_typology
  ON parametric_rules(typology_id);
CREATE INDEX IF NOT EXISTS idx_parametric_rules_standard_code
  ON parametric_rules(standard_code);
CREATE INDEX IF NOT EXISTS idx_parametric_rules_active
  ON parametric_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calc_audits_calculation
  ON calculation_audits(calculation_id);
CREATE INDEX IF NOT EXISTS idx_element_typologies_category
  ON element_typologies(category);
CREATE INDEX IF NOT EXISTS idx_element_typologies_active
  ON element_typologies(is_active) WHERE is_active = true;
