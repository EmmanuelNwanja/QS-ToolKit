const engine = require('../services/ParametricEngine');
const supabase = require('../../../src/config/supabase');
const { success, error } = require('../../../src/utils/responseHelper');
const logger = require('../../../src/utils/logger');

async function requireProjectAccess(projectId, userId, res) {
  if (!projectId) return res.status(400).json(error('project_id is required'));
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
  if (!project) return res.status(404).json(error('Project not found or access denied'));
  return null;
}

async function logUsage(userId, type) {
  try {
    await supabase.from('calculator_usage').insert({ user_id: userId, calculator_type: 'parametric_' + type });
  } catch (err) {
    logger.error('logUsage error:', err?.message);
  }
}

// ── 1. POST /calculate ───────────────────────────────────────────
exports.calculate = async (req, res, next) => {
  try {
    const {
      project_id, element_type, typology_id, standard_code = 'eurocode',
      primary_dimension, secondary_inputs = {}, user_overrides = {}
    } = req.body;

    if (!project_id) return res.status(400).json(error('project_id is required'));
    if (!element_type) return res.status(400).json(error('element_type is required'));
    if (!primary_dimension || primary_dimension <= 0) {
      return res.status(400).json(error('primary_dimension must be > 0'));
    }

    const accessErr = await requireProjectAccess(project_id, req.user.id, res);
    if (accessErr) return;

    const result = await engine.calculateWithWaste({
      element_type,
      primary_dim_mm: primary_dimension,
      standard: standard_code,
      overrides: user_overrides,
      extra: secondary_inputs,
      user_id: req.user.id,
      project_id,
      session_label: secondary_inputs.session_label || `${element_type} calculation`
    });

    const calc = await engine.storeCalculation({
      project_id, typology_id, standard_code,
      inputs: { primary_dimension, secondary_inputs, user_overrides },
      result,
      user_id: req.user.id
    });

    await logUsage(req.user.id, element_type);

    return res.status(201).json(success('Calculation complete', { calculation: calc, result }));
  } catch (err) { next(err); }
};

// ── 2. GET /typologies ────────────────────────────────────────
exports.listTypologies = async (req, res, next) => {
  try {
    const { data: typologies, error: dbErr } = await supabase
      .from('element_typologies')
      .select(`
        id, element_type, name, category, label, icon, description,
        default_standard, supported_standards, is_active
      `)
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (dbErr) return next(dbErr);

    const grouped = {};
    for (const t of typologies) {
      const cat = t.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    }

    return res.json(success('Typologies retrieved', { typologies, grouped }));
  } catch (err) { next(err); }
};

// ── 3. GET /standards/:code/rules ──────────────────────────────
exports.getStandardRules = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { typology_id, element_type } = req.query;

    if (!code) return res.status(400).json(error('Standard code is required'));

    let query = supabase
      .from('parametric_rules')
      .select(`
        id, typology_id, element_type, standard, standard_code,
        rule_name, display_label, code_reference, description,
        formula, rule_config, severity, priority
      `)
      .or(`standard.eq.${code},standard_code.eq.${code}`)
      .eq('is_active', true)
      .order('priority');

    if (typology_id) query = query.eq('typology_id', typology_id);
    if (element_type) query = query.eq('element_type', element_type);

    const { data: rules, error: dbErr } = await query;
    if (dbErr) return next(dbErr);

    return res.json(success('Rules retrieved', {
      standard_code: code,
      rule_count: rules ? rules.length : 0,
      rules: rules || []
    }));
  } catch (err) { next(err); }
};

// ── 4. POST /calculate/compare ─────────────────────────────────
exports.compare = async (req, res, next) => {
  try {
    const {
      project_id, element_type, primary_dimension,
      standards = ['eurocode', 'aci318', 'is456', 'bs8110'],
      overrides = {}, extra = {}
    } = req.body;

    if (!project_id) return res.status(400).json(error('project_id is required'));
    if (!element_type) return res.status(400).json(error('element_type is required'));
    if (!primary_dimension || primary_dimension <= 0) {
      return res.status(400).json(error('primary_dimension must be > 0'));
    }

    const accessErr = await requireProjectAccess(project_id, req.user.id, res);
    if (accessErr) return;

    const comparison = await engine.compareStandards({
      element_type, primary_dim_mm: primary_dimension, standards, overrides, extra
    });

    await logUsage(req.user.id, element_type + '_compare');

    return res.json(success('Standard comparison complete', { comparison }));
  } catch (err) { next(err); }
};

// ── 5. POST /calculations/:id/inject-boq ───────────────────────
exports.injectBoq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { boq_id, section_id } = req.body;

    if (!boq_id) return res.status(400).json(error('boq_id is required'));

    const { data: calc, error: calcErr } = await supabase
      .from('parametric_calculations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (calcErr) return next(calcErr);
    if (!calc) return res.status(404).json(error('Calculation not found'));

    const { data: boq, error: boqErr } = await supabase
      .from('boq_documents').select('id, project_id').eq('id', boq_id).maybeSingle();
    if (boqErr) return next(boqErr);
    if (!boq) return res.status(404).json(error('BOQ not found'));
    if (boq.project_id !== calc.project_id) {
      return res.status(403).json(error('BOQ does not belong to the same project'));
    }

    let targetSectionId = section_id;
    if (!targetSectionId) {
      const { data: sections } = await supabase
        .from('boq_sections').select('id').eq('boq_id', boq_id).limit(1);
      if (!sections || sections.length === 0) {
        return res.status(400).json(error('BOQ has no sections. Create a section first.'));
      }
      targetSectionId = sections[0].id;
    }

    const quantities = calc.quantities || {};
    const derived = calc.derived_dimensions || {};
    const cascade = calc.cascade || {};
    const elementType = calc.inputs?.element_type || 'element';
    const label = elementType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const std = (calc.standard_code || 'EC').toUpperCase();
    const catMap = {
      beam: 'Reinforced concrete beam (in-situ)', column: 'Reinforced concrete column (in-situ)',
      slab: 'Reinforced concrete slab (in-situ)', staircase: 'Reinforced concrete staircase',
      footing: 'Reinforced concrete footing', wall: 'Reinforced concrete wall',
      circular_column: 'Reinforced concrete circular column',
      cylindrical_wall: 'Reinforced concrete cylindrical wall/tank',
      curved_beam: 'Reinforced concrete curved beam', dome_shell: 'Reinforced concrete dome shell'
    };
    const cat = catMap[elementType] || `Reinforced concrete ${elementType}`;

    const dimensionStr = `${derived.depth_mm || derived.thickness_mm || derived.diameter_mm || ''}${derived.width_mm ? ' × ' + derived.width_mm : ''}`;
    const lines = [];

    lines.push({
      section_id: targetSectionId, item_no: '1',
      description: `${cat} — ${label} (${std}): ${dimensionStr} — concrete grade 25/30`,
      unit: 'm³', quantity: quantities.concrete_volume_m3 || 0, rate: 0, amount: 0,
      cost_class: 'measured_work', material_type: 'concrete'
    });

    const fwDesc = quantities.formwork_breakdown
      ? Object.keys(quantities.formwork_breakdown).filter(k => k !== 'note' && k !== 'total_m2').join(', ')
      : 'sides and soffit only';
    lines.push({
      section_id: targetSectionId, item_no: '2',
      description: `Formwork to reinforced concrete ${label}: ${fwDesc}`,
      unit: 'm²', quantity: quantities.formwork_m2 || 0, rate: 0, amount: 0,
      cost_class: 'measured_work', material_type: 'formwork'
    });

    const rebarKg = quantities.reinforcement_kg || 0;
    lines.push({
      section_id: targetSectionId, item_no: '3',
      description: `Reinforcement steel (high yield, ${quantities.reinforcement_kg_per_m3 || 120} kg/m³ density) to ${label}`,
      unit: 'tonne', quantity: +(rebarKg / 1000).toFixed(4), rate: 0, amount: 0,
      cost_class: 'measured_work', material_type: 'reinforcement'
    });

    if ((cascade.screed_volume_m3 || 0) > 0) {
      lines.push({
        section_id: targetSectionId, item_no: '4', unit: 'm³',
        description: `Cement and sand screed (1:3, 75mm avg thickness) to ${label}`,
        quantity: cascade.screed_volume_m3, rate: 0, amount: 0,
        cost_class: 'measured_work', material_type: 'screed'
      });
    }
    if ((cascade.tiling_area_m2 || 0) > 0) {
      lines.push({
        section_id: targetSectionId, item_no: '5', unit: 'm²',
        description: `Floor/wall tiling (incl. 5% cutting waste) to ${label}`,
        quantity: cascade.tiling_area_m2, rate: 0, amount: 0,
        cost_class: 'measured_work', material_type: 'tiling'
      });
    }
    if ((cascade.plaster_area_m2 || 0) > 0) {
      lines.push({
        section_id: targetSectionId, item_no: '6', unit: 'm²',
        description: `Cement and sand plaster (1:4, 18mm thick) to exposed ${label} faces`,
        quantity: cascade.plaster_area_m2, rate: 0, amount: 0,
        cost_class: 'measured_work', material_type: 'plaster'
      });
    }
    if ((cascade.paint_area_m2 || 0) > 0) {
      lines.push({
        section_id: targetSectionId, item_no: '7', unit: 'm²',
        description: `Emulsion paint (2 coats) to plastered ${label} surfaces`,
        quantity: cascade.paint_area_m2, rate: 0, amount: 0,
        cost_class: 'measured_work', material_type: 'paint'
      });
    }
    if ((cascade.skirting_length_m || 0) > 0) {
      lines.push({
        section_id: targetSectionId, item_no: '8', unit: 'm',
        description: `Skirting (cement mortar 1:3, 150mm high) to ${label} perimeter`,
        quantity: cascade.skirting_length_m, rate: 0, amount: 0,
        cost_class: 'measured_work', material_type: 'skirting'
      });
    }

    const inserted = [];
    for (const line of lines) {
      const { data: item, error: itemErr } = await supabase
        .from('boq_items').insert(line).select().single();
      if (itemErr) return next(itemErr);
      inserted.push(item);
    }

    await supabase.rpc('recalc_section_total', { section_id_param: targetSectionId }).catch(() => {});

    await supabase
      .from('parametric_calculations')
      .update({ estimate_id: boq_id })
      .eq('id', id)
      .catch(() => {});

    return res.status(201).json(success(`${inserted.length} BOQ lines injected`, {
      calculation_id: id, boq_id, section_id: targetSectionId,
      lines_inserted: inserted.length, lines: inserted
    }));
  } catch (err) { next(err); }
};

// ── 6. PUT /calculations/:id/override ──────────────────────────
exports.applyOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { overrides = {}, secondary_inputs = {} } = req.body;

    if (!overrides || Object.keys(overrides).length === 0) {
      return res.status(400).json(error('At least one override field is required'));
    }

    const { data: calc, error: calcErr } = await supabase
      .from('parametric_calculations')
      .select('*, projects!inner(user_id)')
      .eq('id', id)
      .maybeSingle();
    if (calcErr) return next(calcErr);
    if (!calc) return res.status(404).json(error('Calculation not found'));
    if (calc.projects?.user_id !== req.user.id) {
      return res.status(403).json(error('Not authorized to modify this calculation'));
    }

    const inputs = calc.inputs || {};
    const mergedOverrides = { ...inputs.user_overrides, ...overrides };

    const result = await engine.calculateWithWaste({
      element_type: inputs.element_type || calc.inputs?.element_type,
      primary_dim_mm: inputs.primary_dimension,
      standard: calc.standard_code || 'eurocode',
      overrides: mergedOverrides,
      extra: { ...(inputs.secondary_inputs || {}), ...secondary_inputs },
      user_id: req.user.id,
      project_id: calc.project_id,
      session_label: `override-${calc.id}`
    });

    result.overrides_applied = [
      ...(result.overrides_applied || []),
      ...Object.keys(overrides).map(k => ({
        field: k, user_value: overrides[k],
        auto_value: result.derived?.[k] || null
      }))
    ];

    const updatedCalc = await engine.storeCalculation({
      project_id: calc.project_id,
      typology_id: calc.typology_id,
      standard_code: calc.standard_code,
      inputs: { ...inputs, user_overrides: mergedOverrides },
      result,
      user_id: req.user.id
    });

    await supabase.from('calculation_audits').insert({
      calculation_id: updatedCalc.id,
      rule_applied: 'user_override',
      rule_name: 'user_override',
      element_type: result.element_type,
      standard: result.standard,
      assumption: JSON.stringify(overrides),
      auto_value: null,
      computed_value: null,
      final_value: null,
      is_overridden: true
    }).catch(() => {});

    await logUsage(req.user.id, result.element_type + '_override');

    return res.json(success('Override applied, quantities recalculated', {
      previous_calculation_id: id,
      new_calculation_id: updatedCalc.id,
      overrides_applied: Object.keys(overrides),
      result
    }));
  } catch (err) { next(err); }
};

// ── 7. POST /calculate/circular ───────────────────────────────────
exports.calculateCircular = async (req, res, next) => {
  try {
    const { project_id, diameter, height, standard_code = 'eurocode', cover } = req.body;

    if (!project_id) return res.status(400).json(error('project_id is required'));
    if (!diameter || diameter <= 0) return res.status(400).json(error('diameter must be > 0'));
    if (!height || height <= 0) return res.status(400).json(error('height must be > 0'));

    const accessErr = await requireProjectAccess(project_id, req.user.id, res);
    if (accessErr) return;

    const extra = { diameter_mm: diameter, wall_height_m: height };
    if (cover) extra.cover_mm = cover;

    const result = await engine.calculateWithWaste({
      element_type: 'circular_column',
      primary_dim_mm: height,
      standard: standard_code,
      overrides: {},
      extra,
      user_id: req.user.id,
      project_id
    });

    const d = result.derived || {};
    const q = result.quantities || {};

    const coverageLength = d.diameter_mm
      ? Math.floor(Math.PI * (d.diameter_mm - 2 * (d.cover_mm || 40)) / 200) + 1
      : 0;
    const spiralPitch = 100;
    const spiralCount = d.height_m ? Math.ceil(d.height_m / (spiralPitch / 1000)) : 0;
    const spiralLength = d.diameter_mm
      ? Math.round(Math.PI * ((d.diameter_mm - (d.cover_mm || 40)) / 1000) * spiralCount * 1000) / 1000
      : 0;

    await logUsage(req.user.id, 'circular_column');

    return res.json(success('Circular column calculation complete', {
      project_id,
      element_type: 'circular_column',
      standard: standard_code,
      derived_dimensions: {
        diameter_mm: d.diameter_mm,
        height_m: d.height_m,
        cover_mm: d.cover_mm,
        cross_section_area_m2: d.cross_section_area_m2,
        slenderness: d.slenderness
      },
      quantities: {
        volume_m3: q.concrete_volume_m3,
        formwork_area_m2: q.formwork_m2,
        reinforcement_kg: q.reinforcement_kg
      },
      circular_details: {
        longitudinal_bar_count: coverageLength,
        spiral_tie_count: spiralCount,
        spiral_tie_length_m: spiralLength
      },
      formwork: q.formwork_breakdown,
      audit: result.audit,
      warnings: result.warnings
    }));
  } catch (err) { next(err); }
};

// ── 8. POST /calculate/cylindrical ────────────────────────────────
exports.calculateCylindrical = async (req, res, next) => {
  try {
    const { project_id, internal_diameter, height, fluid_pressure, standard_code = 'eurocode' } = req.body;

    if (!project_id) return res.status(400).json(error('project_id is required'));
    if (!internal_diameter || internal_diameter <= 0) {
      return res.status(400).json(error('internal_diameter must be > 0'));
    }
    if (!height || height <= 0) return res.status(400).json(error('height must be > 0'));

    const accessErr = await requireProjectAccess(project_id, req.user.id, res);
    if (accessErr) return;

    const extra = { wall_height_m: height };
    if (fluid_pressure) extra.fluid_pressure_kpa = fluid_pressure;

    const result = await engine.calculateWithWaste({
      element_type: 'cylindrical_wall',
      primary_dim_mm: internal_diameter,
      standard: standard_code,
      overrides: {},
      extra,
      user_id: req.user.id,
      project_id
    });

    const d = result.derived || {};
    const q = result.quantities || {};

    const hoopReinforcement = d.external_diameter_mm
      ? Math.round(Math.PI * d.external_diameter_mm * d.height_m / 200 * 1000) / 1000
      : 0;

    await logUsage(req.user.id, 'cylindrical_wall');

    return res.json(success('Cylindrical wall calculation complete', {
      project_id,
      element_type: 'cylindrical_wall',
      standard: standard_code,
      derived_dimensions: {
        internal_diameter_mm: d.internal_diameter_mm,
        external_diameter_mm: d.external_diameter_mm,
        wall_thickness_mm: d.thickness_mm,
        height_m: d.height_m,
        diameter_to_thickness_ratio: d.diameter_to_thickness_ratio
      },
      quantities: {
        concrete_volume_m3: q.concrete_volume_m3,
        external_formwork_m2: q.formwork_breakdown?.external_m2,
        internal_formwork_m2: q.formwork_breakdown?.internal_m2,
        edge_formwork_m2: q.formwork_breakdown?.edges_m2,
        total_formwork_m2: q.formwork_m2,
        reinforcement_kg: q.reinforcement_kg
      },
      cylindrical_details: {
        hoop_reinforcement_length_m: hoopReinforcement,
        fluid_pressure_kpa: fluid_pressure || null
      },
      formwork_notes: q.formwork_breakdown?.note,
      audit: result.audit,
      warnings: result.warnings
    }));
  } catch (err) { next(err); }
};

// ── 9. POST /calculate/curved ─────────────────────────────────
exports.calculateCurved = async (req, res, next) => {
  try {
    const { project_id, chord_length, rise, width, standard_code = 'eurocode' } = req.body;

    if (!project_id) return res.status(400).json(error('project_id is required'));
    if (!chord_length || chord_length <= 0) return res.status(400).json(error('chord_length must be > 0'));
    if (!rise || rise <= 0) return res.status(400).json(error('rise must be > 0'));

    const accessErr = await requireProjectAccess(project_id, req.user.id, res);
    if (accessErr) return;

    const extra = { rise_mm: rise };
    if (width) extra.width_mm = width;

    const result = await engine.calculateWithWaste({
      element_type: 'curved_beam',
      primary_dim_mm: chord_length,
      standard: standard_code,
      overrides: {},
      extra,
      user_id: req.user.id,
      project_id
    });

    const d = result.derived || {};
    const q = result.quantities || {};
    const fw = q.formwork_breakdown || {};

    await logUsage(req.user.id, 'curved_beam');

    return res.json(success('Curved beam calculation complete', {
      project_id,
      element_type: 'curved_beam',
      standard: standard_code,
      geometry: {
        radius_m: d.radius_m,
        arc_length_m: d.arc_length_m,
        angle_deg: d.angle_deg,
        chord_length_m: d.chord_length_m,
        rise_mm: d.rise_mm
      },
      derived_dimensions: {
        depth_mm: d.depth_mm,
        width_mm: d.width_mm,
        span_to_depth_ratio: d.span_to_depth_ratio,
        cover_mm: d.cover_mm
      },
      quantities: {
        concrete_volume_m3: q.concrete_volume_m3,
        formwork_m2: q.formwork_m2,
        reinforcement_kg: q.reinforcement_kg
      },
      formwork_breakdown: {
        soffit_curved_m2: fw.soffit_curved_m2,
        sides_curved_m2: fw.sides_curved_m2,
        radial_ends_m2: fw.radial_ends_m2
      },
      warnings: result.warnings,
      variable_stirrup_warning: 'Stirrups along curved beam require variable width. Use detailed bar bending schedule.'
    }));
  } catch (err) { next(err); }
};

// ── 10. POST /calculate/dome ──────────────────────────────────
exports.calculateDome = async (req, res, next) => {
  try {
    const { project_id, base_diameter, rise, standard_code = 'eurocode' } = req.body;

    if (!project_id) return res.status(400).json(error('project_id is required'));
    if (!base_diameter || base_diameter <= 0) return res.status(400).json(error('base_diameter must be > 0'));
    if (!rise || rise <= 0) return res.status(400).json(error('rise must be > 0'));

    const accessErr = await requireProjectAccess(project_id, req.user.id, res);
    if (accessErr) return;

    const result = await engine.calculateWithWaste({
      element_type: 'dome_shell',
      primary_dim_mm: base_diameter,
      standard: standard_code,
      overrides: {},
      extra: { rise_m: rise / 1000 },
      user_id: req.user.id,
      project_id
    });

    const d = result.derived || {};
    const q = result.quantities || {};

    await logUsage(req.user.id, 'dome_shell');

    return res.json(success('Dome shell calculation complete', {
      project_id,
      element_type: 'dome_shell',
      standard: standard_code,
      geometry: {
        base_diameter_m: d.base_diameter_m,
        rise_m: d.rise_m,
        sphere_radius_m: d.sphere_radius_m,
        rise_to_diameter_ratio: d.rise_to_diameter_ratio
      },
      derived_dimensions: {
        surface_area_m2: d.surface_area_m2,
        shell_thickness_mm: d.thickness_mm,
        base_circumference_m: d.base_circumference_m,
        thin_shell: d.thin_shell
      },
      quantities: {
        concrete_volume_m3: q.concrete_volume_m3,
        formwork_m2: q.formwork_m2,
        reinforcement_kg: q.reinforcement_kg
      },
      formwork: q.formwork_breakdown,
      specialist_formwork_flag: 'Specialist centering required for spherical soffit. Standard props not applicable.',
      audit: result.audit,
      warnings: result.warnings
    }));
  } catch (err) { next(err); }
};
