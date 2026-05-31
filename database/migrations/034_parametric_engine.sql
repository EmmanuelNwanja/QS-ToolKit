-- ================================================================
-- Smart Parametric Calculator Engine
-- Tables: parametric_rules, element_typologies, 
--         calculation_audits, derived_dimensions
-- ================================================================

-- 1. Element Typologies — defines structural element categories
CREATE TABLE IF NOT EXISTS element_typologies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  element_type  TEXT NOT NULL UNIQUE,          -- beam, column, slab, footing, wall
  label         TEXT NOT NULL,                  -- Beam, Column, Slab, etc.
  icon          TEXT DEFAULT '🏗️',
  description   TEXT,
  default_standard TEXT DEFAULT 'eurocode',
  supported_standards TEXT[] DEFAULT ARRAY['eurocode','aci','is456','bs8110','international'],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Parametric Rules — traceable rule definitions per standard
CREATE TABLE IF NOT EXISTS parametric_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  element_type      TEXT NOT NULL REFERENCES element_typologies(element_type),
  standard          TEXT NOT NULL,               -- eurocode, aci, is456, bs8110
  rule_name         TEXT NOT NULL,               -- e.g. 'beam_min_depth_ratio'
  display_label     TEXT,
  code_reference    TEXT,                        -- e.g. 'Eurocode 2 Table 7.4N'
  description       TEXT,
  formula           TEXT,                        -- human-readable formula
  parameters        JSONB DEFAULT '{}',          -- { min_ratio: 10, max_ratio: 12 }
  severity          TEXT DEFAULT 'heuristic',    -- mandatory | heuristic | optional
  priority          INT DEFAULT 100,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Derived Dimensions — per-session calculation results
CREATE TABLE IF NOT EXISTS derived_dimensions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  session_label     TEXT,
  element_type      TEXT NOT NULL,
  standard          TEXT NOT NULL DEFAULT 'eurocode',
  primary_dim       NUMERIC NOT NULL,            -- span / length in mm
  primary_dim_label TEXT DEFAULT 'Span (mm)',

  -- Derived structural dimensions
  depth_mm          NUMERIC,
  width_mm          NUMERIC,
  thickness_mm      NUMERIC,
  height_mm         NUMERIC,
  length_mm         NUMERIC,

  -- Derived quantities
  concrete_volume_m3    NUMERIC,
  formwork_m2           NUMERIC,
  formwork_breakdown    JSONB,                  -- { sides_m2, soffit_m2, ... }
  reinforcement_kg      NUMERIC,
  reinforcement_kg_m3   NUMERIC,

  -- Cascade finishes
  plaster_area_m2       NUMERIC,
  paint_area_m2         NUMERIC,
  screed_volume_m3      NUMERIC,
  tiling_area_m2        NUMERIC,
  skirting_length_m     NUMERIC,

  -- Override tracking
  overrides_applied     JSONB DEFAULT '[]',     -- list of overridden fields
  warnings              JSONB DEFAULT '[]',      -- deviation warnings

  -- Audit
  rules_applied         UUID[] DEFAULT ARRAY[]::UUID[],  -- references parametric_rules
  raw_input             JSONB,
  raw_output            JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Calculation Audits — immutable audit trail
CREATE TABLE IF NOT EXISTS calculation_audits (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  dimension_id      UUID REFERENCES derived_dimensions(id),
  element_type      TEXT NOT NULL,
  standard          TEXT NOT NULL,
  rule_id           UUID REFERENCES parametric_rules(id),
  rule_name         TEXT NOT NULL,
  input_value       NUMERIC,
  computed_value    NUMERIC,
  formula_trace     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_derived_dimensions_user ON derived_dimensions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_derived_dimensions_project ON derived_dimensions(project_id);
CREATE INDEX IF NOT EXISTS idx_calc_audits_user ON calculation_audits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calc_audits_rule ON calculation_audits(rule_id);
CREATE INDEX IF NOT EXISTS idx_parametric_rules_element ON parametric_rules(element_type, standard);

-- Seed element typologies
INSERT INTO element_typologies (element_type, label, icon, description) VALUES
  ('beam',     'Beam',     '🏗️', 'Horizontal structural member spanning between supports'),
  ('column',   'Column',   '🏛️', 'Vertical compression member transferring loads to foundation'),
  ('slab',     'Slab',     '🏢', 'Horizontal planar structural element, floor or roof'),
  ('footing',  'Footing',  '🧱', 'Foundation element distributing column/wall loads to ground'),
  ('wall',     'Wall',     '🧱', 'Vertical structural or non-structural element')
ON CONFLICT (element_type) DO NOTHING;

-- Seed parametric rules — Eurocode 2
INSERT INTO parametric_rules (element_type, standard, rule_name, display_label, code_reference, description, formula, parameters, severity, priority) VALUES
  ('beam', 'eurocode', 'beam_min_depth_simply_supported', 'Min Depth (Simply Supported)', 'Eurocode 2 Table 7.4N', 'Minimum depth/span ratio for simply supported beams', 'h ≥ span / 10', '{"ratio": 10, "min_depth_mm": 200}', 'mandatory', 10),
  ('beam', 'eurocode', 'beam_min_depth_continuous', 'Min Depth (Continuous)', 'Eurocode 2 Table 7.4N', 'Minimum depth/span ratio for continuous beams', 'h ≥ span / 12', '{"ratio": 12, "min_depth_mm": 200}', 'mandatory', 20),
  ('beam', 'eurocode', 'beam_width_ratio', 'Width Ratio', 'Eurocode 2 Cl. 5.3.2', 'Width to depth ratio for rectangular beams', 'b ≈ h / 2 to h / 3', '{"min_ratio": 2, "max_ratio": 3, "min_width_mm": 150}', 'heuristic', 30),
  ('beam', 'eurocode', 'beam_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Nominal cover for XC1 exposure class', 'cover = 30mm', '{"cover_mm": 30}', 'mandatory', 40),
  ('beam', 'eurocode', 'beam_reinf_density', 'Reinforcement Density', 'Eurocode 2', 'Typical reinforcement density for beams', 'ρ = 120 kg/m³', '{"kg_per_m3": 120, "min_kg_per_m3": 80, "max_kg_per_m3": 200}', 'heuristic', 50),
  ('beam', 'eurocode', 'formwork_side_forms', 'Side Formwork', 'SMM7', 'Vertical side formwork area for both faces', '2 × h × L', '{}', 'heuristic', 60),
  ('beam', 'eurocode', 'formwork_soffit', 'Soffit Formwork', 'SMM7', 'Bottom formwork for beam soffit', 'b × L', '{}', 'heuristic', 70),

  ('column', 'eurocode', 'column_min_size', 'Min Section Size', 'Eurocode 2 Cl. 5.3.1', 'Minimum column cross-section dimension', 'b ≥ 230mm, h ≥ 230mm', '{"min_size_mm": 230}', 'mandatory', 10),
  ('column', 'eurocode', 'column_size_estimation', 'Size by Height', 'Eurocode 2', 'Column dimension relative to storey height', 'size ≈ H / 15 to H / 10', '{"min_ratio": 10, "max_ratio": 15, "min_size_mm": 230}', 'heuristic', 20),
  ('column', 'eurocode', 'column_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Nominal cover for interior columns', 'cover = 30mm', '{"cover_mm": 30}', 'mandatory', 30),
  ('column', 'eurocode', 'column_reinf_density', 'Reinforcement Density', 'Eurocode 2', 'Typical reinforcement density for columns', 'ρ = 150 kg/m³', '{"kg_per_m3": 150, "min_kg_per_m3": 100, "max_kg_per_m3": 250}', 'heuristic', 40),
  ('column', 'eurocode', 'formwork_vertical_faces', 'Column Formwork', 'SMM7', 'Vertical formwork around column perimeter', '2 × (b + h) × H', '{}', 'heuristic', 50),

  ('slab', 'eurocode', 'slab_min_thickness_one_way', 'Min Thickness (One-Way)', 'Eurocode 2 Cl. 7.4.1', 'Minimum thickness for one-way spanning slab', 'h ≥ span / 30', '{"ratio": 30, "min_thickness_mm": 120}', 'mandatory', 10),
  ('slab', 'eurocode', 'slab_min_thickness_two_way', 'Min Thickness (Two-Way)', 'Eurocode 2 Cl. 7.4.1', 'Minimum thickness for two-way spanning slab', 'h ≥ span / 35', '{"ratio": 35, "min_thickness_mm": 120}', 'mandatory', 20),
  ('slab', 'eurocode', 'slab_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Nominal cover for slab soffit', 'cover = 25mm', '{"cover_mm": 25}', 'mandatory', 30),
  ('slab', 'eurocode', 'slab_reinf_density', 'Reinforcement Density', 'Eurocode 2', 'Typical reinforcement density for slabs', 'ρ = 100 kg/m³', '{"kg_per_m3": 100, "min_kg_per_m3": 60, "max_kg_per_m3": 160}', 'heuristic', 40),
  ('slab', 'eurocode', 'formwork_soffit_only', 'Soffit Formwork', 'SMM7', 'Soffit formwork (top excluded — walking surface)', 'L × W', '{}', 'heuristic', 50),

  ('footing', 'eurocode', 'footing_min_base_thickness', 'Min Base Thickness', 'Eurocode 2 Cl. 5.1.1', 'Minimum foundation slab thickness', 'h ≥ 200mm', '{"min_thickness_mm": 200}', 'mandatory', 10),
  ('footing', 'eurocode', 'footing_base_size', 'Base Size', 'Eurocode 2', 'Footing base dimension relative to column', 'B = column_size + 2 × projection (min 300mm)', '{"min_projection_mm": 300}', 'heuristic', 20),
  ('footing', 'eurocode', 'footing_reinf_density', 'Reinforcement Density', 'Eurocode 2', 'Typical reinforcement density for footings', 'ρ = 80 kg/m³', '{"kg_per_m3": 80, "min_kg_per_m3": 50, "max_kg_per_m3": 120}', 'heuristic', 30),
  ('footing', 'eurocode', 'formwork_edges', 'Edge Formwork', 'SMM7', 'Vertical formwork around footing perimeter', '2 × (L + W) × h', '{}', 'heuristic', 40),

  ('wall', 'eurocode', 'wall_min_thickness', 'Min Wall Thickness', 'Eurocode 2 Cl. 9.6.1', 'Minimum structural wall thickness', 'h ≥ 150mm', '{"min_thickness_mm": 150}', 'mandatory', 10),
  ('wall', 'eurocode', 'wall_reinf_density', 'Reinforcement Density', 'Eurocode 2', 'Typical reinforcement density for walls', 'ρ = 100 kg/m³', '{"kg_per_m3": 100, "min_kg_per_m3": 60, "max_kg_per_m3": 180}', 'heuristic', 20),
  ('wall', 'eurocode', 'formwork_both_sides', 'Both-Side Formwork', 'SMM7', 'Vertical formwork on both wall faces', '2 × L × H', '{}', 'heuristic', 30)
ON CONFLICT DO NOTHING;

-- Seed parametric rules — ACI 318
INSERT INTO parametric_rules (element_type, standard, rule_name, display_label, code_reference, description, formula, parameters, severity, priority) VALUES
  ('beam', 'aci', 'beam_min_depth_simply_supported', 'Min Depth (Simply Supported)', 'ACI 318 Table 9.3.1.1', 'Minimum depth/span for simply supported beams', 'h ≥ span / 16', '{"ratio": 16, "min_depth_mm": 200}', 'mandatory', 10),
  ('beam', 'aci', 'beam_min_depth_continuous', 'Min Depth (Continuous)', 'ACI 318 Table 9.3.1.1', 'Minimum depth/span for continuous beams', 'h ≥ span / 21', '{"ratio": 21, "min_depth_mm": 200}', 'mandatory', 20),
  ('beam', 'aci', 'beam_width_ratio', 'Width Ratio', 'ACI 318 Cl. 6.3.2', 'Width to depth ratio', 'b ≈ h / 1.5 to h / 2', '{"min_ratio": 1.5, "max_ratio": 2, "min_width_mm": 150}', 'heuristic', 30),
  ('beam', 'aci', 'beam_cover', 'Concrete Cover', 'ACI 318 Table 20.6.1.3.1', 'Cover for interior beams', 'cover = 40mm', '{"cover_mm": 40}', 'mandatory', 40),
  ('beam', 'aci', 'beam_reinf_density', 'Reinforcement Density', 'ACI 318', 'Typical reinforcement density for beams', 'ρ = 130 kg/m³', '{"kg_per_m3": 130, "min_kg_per_m3": 80, "max_kg_per_m3": 220}', 'heuristic', 50),

  ('column', 'aci', 'column_min_size', 'Min Section Size', 'ACI 318 Cl. 10.3.5', 'Minimum column dimension', 'b ≥ 250mm', '{"min_size_mm": 250}', 'mandatory', 10),
  ('column', 'aci', 'column_size_estimation', 'Size by Height', 'ACI 318', 'Column dimension relative to height', 'size ≈ H / 12 to H / 8', '{"min_ratio": 8, "max_ratio": 12, "min_size_mm": 250}', 'heuristic', 20),
  ('column', 'aci', 'column_reinf_density', 'Reinforcement Density', 'ACI 318', 'Typical reinforcement density for columns (US)', 'ρ = 160 kg/m³', '{"kg_per_m3": 160, "min_kg_per_m3": 100, "max_kg_per_m3": 280}', 'heuristic', 30),

  ('slab', 'aci', 'slab_min_thickness_one_way', 'Min Thickness (One-Way)', 'ACI 318 Table 7.3.1.1', 'Minimum thickness for one-way slab', 'h ≥ span / 20', '{"ratio": 20, "min_thickness_mm": 125}', 'mandatory', 10),
  ('slab', 'aci', 'slab_min_thickness_two_way', 'Min Thickness (Two-Way)', 'ACI 318 Table 7.3.1.1', 'Minimum thickness for two-way slab', 'h ≥ span / 24', '{"ratio": 24, "min_thickness_mm": 125}', 'mandatory', 20),
  ('slab', 'aci', 'slab_reinf_density', 'Reinforcement Density', 'ACI 318', 'Typical reinforcement density for slabs', 'ρ = 110 kg/m³', '{"kg_per_m3": 110, "min_kg_per_m3": 60, "max_kg_per_m3": 180}', 'heuristic', 30),

  ('footing', 'aci', 'footing_min_base_thickness', 'Min Base Thickness', 'ACI 318 Cl. 13.3.1.2', 'Minimum footing thickness', 'h ≥ 300mm', '{"min_thickness_mm": 300}', 'mandatory', 10),
  ('footing', 'aci', 'footing_reinf_density', 'Reinforcement Density', 'ACI 318', 'Typical reinforcement density for footings', 'ρ = 90 kg/m³', '{"kg_per_m3": 90, "min_kg_per_m3": 50, "max_kg_per_m3": 130}', 'heuristic', 20),

  ('wall', 'aci', 'wall_min_thickness', 'Min Wall Thickness', 'ACI 318 Cl. 11.6.1', 'Minimum structural wall thickness', 'h ≥ 150mm', '{"min_thickness_mm": 150}', 'mandatory', 10),
  ('wall', 'aci', 'wall_reinf_density', 'Reinforcement Density', 'ACI 318', 'Typical reinforcement density for walls', 'ρ = 110 kg/m³', '{"kg_per_m3": 110, "min_kg_per_m3": 60, "max_kg_per_m3": 200}', 'heuristic', 20)
ON CONFLICT DO NOTHING;

-- Seed parametric rules — IS 456 (India)
INSERT INTO parametric_rules (element_type, standard, rule_name, display_label, code_reference, description, formula, parameters, severity, priority) VALUES
  ('beam', 'is456', 'beam_min_depth_simply_supported', 'Min Depth (Simply Supported)', 'IS 456 Cl. 23.2.1', 'Minimum depth/span for simply supported beams', 'h ≥ span / 12', '{"ratio": 12, "min_depth_mm": 200}', 'mandatory', 10),
  ('beam', 'is456', 'beam_min_depth_continuous', 'Min Depth (Continuous)', 'IS 456 Cl. 23.2.1', 'Minimum depth/span for continuous beams', 'h ≥ span / 15', '{"ratio": 15, "min_depth_mm": 200}', 'mandatory', 20),
  ('beam', 'is456', 'beam_width_ratio', 'Width Ratio', 'IS 456 Cl. 26.1.1', 'Width to depth ratio', 'b ≈ h / 2 to h / 2.5', '{"min_ratio": 2, "max_ratio": 2.5, "min_width_mm": 150}', 'heuristic', 30),
  ('beam', 'is456', 'beam_cover', 'Concrete Cover', 'IS 456 Cl. 26.4', 'Nominal cover for moderate exposure', 'cover = 30mm', '{"cover_mm": 30}', 'mandatory', 40),
  ('beam', 'is456', 'beam_reinf_density', 'Reinforcement Density', 'IS 456', 'Typical reinforcement density for beams', 'ρ = 120 kg/m³', '{"kg_per_m3": 120, "min_kg_per_m3": 80, "max_kg_per_m3": 200}', 'heuristic', 50),

  ('column', 'is456', 'column_min_size', 'Min Section Size', 'IS 456 Cl. 25.3.1', 'Minimum column dimension', 'b ≥ 200mm', '{"min_size_mm": 200}', 'mandatory', 10),
  ('column', 'is456', 'column_size_estimation', 'Size by Height', 'IS 456', 'Column dimension relative to height', 'size ≈ H / 15 to H / 10', '{"min_ratio": 10, "max_ratio": 15, "min_size_mm": 200}', 'heuristic', 20),
  ('column', 'is456', 'column_reinf_density', 'Reinforcement Density', 'IS 456', 'Typical reinforcement density for columns', 'ρ = 140 kg/m³', '{"kg_per_m3": 140, "min_kg_per_m3": 80, "max_kg_per_m3": 240}', 'heuristic', 30),

  ('slab', 'is456', 'slab_min_thickness_one_way', 'Min Thickness (One-Way)', 'IS 456 Cl. 24.1', 'Minimum thickness for one-way slab', 'h ≥ span / 30', '{"ratio": 30, "min_thickness_mm": 100}', 'mandatory', 10),
  ('slab', 'is456', 'slab_min_thickness_two_way', 'Min Thickness (Two-Way)', 'IS 456 Cl. 24.1', 'Minimum thickness for two-way slab', 'h ≥ span / 35', '{"ratio": 35, "min_thickness_mm": 100}', 'mandatory', 20),
  ('slab', 'is456', 'slab_reinf_density', 'Reinforcement Density', 'IS 456', 'Typical reinforcement density for slabs', 'ρ = 90 kg/m³', '{"kg_per_m3": 90, "min_kg_per_m3": 50, "max_kg_per_m3": 150}', 'heuristic', 30),

  ('footing', 'is456', 'footing_min_base_thickness', 'Min Base Thickness', 'IS 456 Cl. 34.1.2', 'Minimum footing thickness', 'h ≥ 150mm', '{"min_thickness_mm": 150}', 'mandatory', 10),
  ('footing', 'is456', 'footing_reinf_density', 'Reinforcement Density', 'IS 456', 'Typical reinforcement density for footings', 'ρ = 75 kg/m³', '{"kg_per_m3": 75, "min_kg_per_m3": 50, "max_kg_per_m3": 120}', 'heuristic', 20),

  ('wall', 'is456', 'wall_min_thickness', 'Min Wall Thickness', 'IS 456 Cl. 32.2.1', 'Minimum structural wall thickness', 'h ≥ 100mm', '{"min_thickness_mm": 100}', 'mandatory', 10),
  ('wall', 'is456', 'wall_reinf_density', 'Reinforcement Density', 'IS 456', 'Typical reinforcement density for walls', 'ρ = 90 kg/m³', '{"kg_per_m3": 90, "min_kg_per_m3": 50, "max_kg_per_m3": 160}', 'heuristic', 20)
ON CONFLICT DO NOTHING;

-- Seed parametric rules — BS 8110 (legacy UK)
INSERT INTO parametric_rules (element_type, standard, rule_name, display_label, code_reference, description, formula, parameters, severity, priority) VALUES
  ('beam', 'bs8110', 'beam_min_depth_simply_supported', 'Min Depth (Simply Supported)', 'BS 8110 Table 3.9', 'Minimum depth/span ratio', 'h ≥ span / 12', '{"ratio": 12, "min_depth_mm": 200}', 'mandatory', 10),
  ('beam', 'bs8110', 'beam_min_depth_continuous', 'Min Depth (Continuous)', 'BS 8110 Table 3.9', 'Minimum depth/span for continuous', 'h ≥ span / 15', '{"ratio": 15, "min_depth_mm": 200}', 'mandatory', 20),
  ('beam', 'bs8110', 'beam_reinf_density', 'Reinforcement Density', 'BS 8110', 'Typical reinforcement density', 'ρ = 115 kg/m³', '{"kg_per_m3": 115, "min_kg_per_m3": 80, "max_kg_per_m3": 190}', 'heuristic', 30),

  ('column', 'bs8110', 'column_min_size', 'Min Section Size', 'BS 8110 Cl. 3.12.5.3', 'Minimum column dimension', 'b ≥ 200mm', '{"min_size_mm": 200}', 'mandatory', 10),
  ('column', 'bs8110', 'column_reinf_density', 'Reinforcement Density', 'BS 8110', 'Typical reinforcement density', 'ρ = 140 kg/m³', '{"kg_per_m3": 140, "min_kg_per_m3": 80, "max_kg_per_m3": 250}', 'heuristic', 20),

  ('slab', 'bs8110', 'slab_min_thickness_one_way', 'Min Thickness (One-Way)', 'BS 8110 Table 3.9', 'Minimum thickness for one-way slab', 'h ≥ span / 30', '{"ratio": 30, "min_thickness_mm": 100}', 'mandatory', 10),
  ('slab', 'bs8110', 'slab_min_thickness_two_way', 'Min Thickness (Two-Way)', 'BS 8110 Table 3.9', 'Minimum thickness for two-way slab', 'h ≥ span / 35', '{"ratio": 35, "min_thickness_mm": 100}', 'mandatory', 20),
  ('slab', 'bs8110', 'slab_reinf_density', 'Reinforcement Density', 'BS 8110', 'Typical reinforcement density', 'ρ = 95 kg/m³', '{"kg_per_m3": 95, "min_kg_per_m3": 50, "max_kg_per_m3": 160}', 'heuristic', 30),

  ('footing', 'bs8110', 'footing_min_base_thickness', 'Min Base Thickness', 'BS 8110 Cl. 3.7.1', 'Minimum footing thickness', 'h ≥ 200mm', '{"min_thickness_mm": 200}', 'mandatory', 10),
  ('footing', 'bs8110', 'footing_reinf_density', 'Reinforcement Density', 'BS 8110', 'Typical reinforcement density', 'ρ = 80 kg/m³', '{"kg_per_m3": 80, "min_kg_per_m3": 50, "max_kg_per_m3": 130}', 'heuristic', 20),

  ('wall', 'bs8110', 'wall_min_thickness', 'Min Wall Thickness', 'BS 8110 Cl. 3.12.7.1', 'Minimum wall thickness', 'h ≥ 150mm', '{"min_thickness_mm": 150}', 'mandatory', 10),
  ('wall', 'bs8110', 'wall_reinf_density', 'Reinforcement Density', 'BS 8110', 'Typical reinforcement density', 'ρ = 100 kg/m³', '{"kg_per_m3": 100, "min_kg_per_m3": 60, "max_kg_per_m3": 180}', 'heuristic', 20)
ON CONFLICT DO NOTHING;

-- Seed parametric rules — International (best practice defaults)
INSERT INTO parametric_rules (element_type, standard, rule_name, display_label, code_reference, description, formula, parameters, severity, priority) VALUES
  ('beam', 'international', 'beam_min_depth_simply_supported', 'Min Depth (Simply Supported)', 'International practice', 'Conservative span/depth ratio', 'h ≥ span / 12', '{"ratio": 12, "min_depth_mm": 200}', 'heuristic', 10),
  ('beam', 'international', 'beam_min_depth_continuous', 'Min Depth (Continuous)', 'International practice', 'Conservative span/depth for continuous', 'h ≥ span / 14', '{"ratio": 14, "min_depth_mm": 200}', 'heuristic', 20),
  ('beam', 'international', 'beam_width_ratio', 'Width Ratio', 'International practice', 'Width to depth ratio', 'b ≈ h / 2', '{"min_ratio": 2, "max_ratio": 3, "min_width_mm": 150}', 'heuristic', 30),
  ('beam', 'international', 'beam_reinf_density', 'Reinforcement Density', 'International practice', 'Typical reinforcement density', 'ρ = 120 kg/m³', '{"kg_per_m3": 120, "min_kg_per_m3": 80, "max_kg_per_m3": 200}', 'heuristic', 40),

  ('column', 'international', 'column_min_size', 'Min Section Size', 'International practice', 'Minimum column dimension', 'b ≥ 230mm', '{"min_size_mm": 230}', 'heuristic', 10),
  ('column', 'international', 'column_size_estimation', 'Size by Height', 'International practice', 'Column dimension relative to height', 'size ≈ H / 12', '{"min_ratio": 10, "max_ratio": 15, "min_size_mm": 230}', 'heuristic', 20),
  ('column', 'international', 'column_reinf_density', 'Reinforcement Density', 'International practice', 'Typical reinforcement density', 'ρ = 150 kg/m³', '{"kg_per_m3": 150, "min_kg_per_m3": 100, "max_kg_per_m3": 250}', 'heuristic', 30),

  ('slab', 'international', 'slab_min_thickness_one_way', 'Min Thickness (One-Way)', 'International practice', 'Conservative one-way slab', 'h ≥ span / 30', '{"ratio": 30, "min_thickness_mm": 120}', 'heuristic', 10),
  ('slab', 'international', 'slab_min_thickness_two_way', 'Min Thickness (Two-Way)', 'International practice', 'Conservative two-way slab', 'h ≥ span / 35', '{"ratio": 35, "min_thickness_mm": 120}', 'heuristic', 20),
  ('slab', 'international', 'slab_reinf_density', 'Reinforcement Density', 'International practice', 'Typical reinforcement density', 'ρ = 100 kg/m³', '{"kg_per_m3": 100, "min_kg_per_m3": 60, "max_kg_per_m3": 160}', 'heuristic', 30),

  ('footing', 'international', 'footing_min_base_thickness', 'Min Base Thickness', 'International practice', 'Minimum footing thickness', 'h ≥ 200mm', '{"min_thickness_mm": 200}', 'heuristic', 10),
  ('footing', 'international', 'footing_reinf_density', 'Reinforcement Density', 'International practice', 'Typical reinforcement density', 'ρ = 80 kg/m³', '{"kg_per_m3": 80, "min_kg_per_m3": 50, "max_kg_per_m3": 120}', 'heuristic', 20),

  ('wall', 'international', 'wall_min_thickness', 'Min Wall Thickness', 'International practice', 'Minimum wall thickness', 'h ≥ 150mm', '{"min_thickness_mm": 150}', 'heuristic', 10),
  ('wall', 'international', 'wall_reinf_density', 'Reinforcement Density', 'International practice', 'Typical reinforcement density', 'ρ = 100 kg/m³', '{"kg_per_m3": 100, "min_kg_per_m3": 60, "max_kg_per_m3": 180}', 'heuristic', 20)
ON CONFLICT DO NOTHING;

-- ── New element types for advanced rules ────────────────────────
INSERT INTO element_typologies (element_type, label, icon, description) VALUES
  ('circular_column',  'Circular Column',     '⭕', 'Circular reinforced concrete column'),
  ('cylindrical_wall', 'Cylindrical Wall',    '🛢️', 'Cylindrical wall for tanks, silos, water towers'),
  ('curved_beam',      'Curved Beam',         '〰️', 'Curved/arcuated beam with radial geometry'),
  ('dome_shell',       'Dome / Shell',        '🔮', 'Spherical dome shell roof or slab'),
  ('staircase',        'Staircase',           '🪜', 'Reinforced concrete staircase with landings')
ON CONFLICT (element_type) DO NOTHING;

-- Seed rules for new element types -- Eurocode 2
INSERT INTO parametric_rules (element_type, standard, rule_name, display_label, code_reference, description, formula, parameters, severity, priority) VALUES
  ('staircase', 'eurocode', 'staircase_waist_ratio', 'Waist Thickness Ratio', 'Eurocode 2 Cl. 7.4.1', 'Waist thickness relative to span', 'h_waist >= span / 20', '{"ratio": 20, "min_mm": 100}', 'mandatory', 10),
  ('staircase', 'eurocode', 'staircase_reinf_density', 'Reinforcement Density', 'Eurocode 2', 'Typical staircase reinforcement', 'p = 110 kg/m3', '{"kg_per_m3": 110}', 'heuristic', 20),
  ('staircase', 'eurocode', 'staircase_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Cover for staircase', 'cover = 25mm', '{"cover_mm": 25}', 'mandatory', 30),
  ('circular_column', 'eurocode', 'cc_min_diameter', 'Min Diameter', 'Eurocode 2 Cl. 5.3.1', 'Minimum circular column diameter', 'D >= 300mm', '{"min_mm": 300}', 'mandatory', 10),
  ('circular_column', 'eurocode', 'cc_standard_diameters', 'Standard Diameters', 'Eurocode 2', 'Preferred standard diameters', '300, 450, 600, 900, 1200mm', '{"sizes": [300, 450, 600, 900, 1200]}', 'heuristic', 20),
  ('circular_column', 'eurocode', 'cc_reinf_density', 'Reinf. Density', 'Eurocode 2', 'Typical circular column reinforcement', 'p = 160 kg/m3', '{"kg_per_m3": 160}', 'heuristic', 30),
  ('circular_column', 'eurocode', 'cc_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Cover for circular column', 'cover = 40mm', '{"cover_mm": 40}', 'mandatory', 40),
  ('circular_column', 'eurocode', 'cc_long_bar_spacing', 'Long. Spacing', 'Eurocode 2 Cl. 9.5.2', 'Max spacing of longitudinal bars', 's <= 200mm', '{"spacing_mm": 200}', 'mandatory', 50),
  ('circular_column', 'eurocode', 'cc_spiral_pitch', 'Spiral Tie Pitch', 'Eurocode 2 Cl. 9.5.3', 'Pitch of spiral ties', 'p = 100mm', '{"pitch_mm": 100}', 'heuristic', 60),
  ('cylindrical_wall', 'eurocode', 'cw_wall_thickness', 'Wall Thickness Ratio', 'Eurocode 2 Cl. 9.6.1', 'Cylindrical wall slenderness heuristic', 't >= Di / 40', '{"ratio": 40, "min_mm": 150}', 'heuristic', 10),
  ('cylindrical_wall', 'eurocode', 'cw_reinf_density', 'Reinf. Density', 'Eurocode 2', 'Typical tank/silo wall reinforcement', 'p = 120 kg/m3', '{"kg_per_m3": 120}', 'heuristic', 20),
  ('cylindrical_wall', 'eurocode', 'cw_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Cover for water-retaining structure', 'cover = 40mm', '{"cover_mm": 40}', 'mandatory', 30),
  ('curved_beam', 'eurocode', 'cb_span_depth', 'Span/Depth Ratio', 'Eurocode 2 Table 7.4N', 'Depth relative to chord length (conservative)', 'h >= L_chord / 12', '{"ratio": 12, "min_mm": 200}', 'heuristic', 10),
  ('curved_beam', 'eurocode', 'cb_reinf_density', 'Reinf. Density', 'Eurocode 2', 'Typical curved beam reinforcement', 'p = 130 kg/m3', '{"kg_per_m3": 130}', 'heuristic', 20),
  ('curved_beam', 'eurocode', 'cb_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Cover for curved beam', 'cover = 30mm', '{"cover_mm": 30}', 'mandatory', 30),
  ('dome_shell', 'eurocode', 'ds_thickness_ratio', 'Shell Thickness Ratio', 'Eurocode 2 Cl. 8.2', 'Thin shell thickness relative to diameter', 'h >= D / 60', '{"ratio": 60, "min_mm": 75}', 'heuristic', 10),
  ('dome_shell', 'eurocode', 'ds_reinf_ratio', 'Reinf. Ratio', 'Eurocode 2', 'Reinforcement weight per m2 of domed surface', 'p = 15 kg/m2', '{"kg_per_m2": 15}', 'heuristic', 20),
  ('dome_shell', 'eurocode', 'ds_cover', 'Concrete Cover', 'Eurocode 2 Table 4.1', 'Cover for thin shell', 'cover = 25mm', '{"cover_mm": 25}', 'mandatory', 30)
ON CONFLICT DO NOTHING;
