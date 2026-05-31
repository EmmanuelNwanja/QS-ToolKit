const supabase = require('../../../src/config/supabase');
const { RuleStrategy } = require('./RuleStrategy');
const { RuleContext } = require('./RuleContext');

const RULE_CLASSES = {
  'beam':            './rules/RectangularBeamRule',
  'column':          './rules/RectangularColumnRule',
  'slab':            './rules/SlabRule',
  'staircase':       './rules/StaircaseRule',
  'circular_column': './rules/CircularColumnRule',
  'cylindrical_wall':'./rules/CylindricalWallRule',
  'curved_beam':     './rules/CurvedBeamRule',
  'dome_shell':      './rules/DomeShellRule',
  'footing':         null,
  'wall':            null
};

class ParametricEngine {
  async dispatchNew(elementType, primaryDimMm, standard, overrides, extra) {
    const RuleClass = RULE_CLASSES[elementType];
    if (!RuleClass) return null;
    const rule = new (require(RuleClass))();
    const ctx = new RuleContext({ element_type: elementType, primary_dim_mm: primaryDimMm, standard, overrides, extra });
    return rule.calculate(ctx);
  }

  async dispatchOld(elementType, primaryDimMm, standard, overrides, extra) {
    const strategy = new RuleStrategy(elementType);
    return strategy.dispatch(elementType, primaryDimMm, standard, overrides, extra);
  }

  async calculate({ element_type, primary_dim_mm, standard = 'eurocode', overrides = {}, extra = {}, user_id, project_id, session_label }) {
    let result = await this.dispatchNew(element_type, primary_dim_mm, standard, overrides, extra);
    if (!result) {
      result = await this.dispatchOld(element_type, primary_dim_mm, standard, overrides, extra);
    }

    await this.storeDerivedDimensions(result, user_id, project_id, session_label);
    await this.storeAuditTrail(result, user_id);

    return result;
  }

  async compareStandards({ element_type, primary_dim_mm, standards = ['eurocode', 'aci', 'is456', 'bs8110', 'international'], overrides = {}, extra = {} }) {
    const comparisons = {};
    for (const std of standards) {
      let result = await this.dispatchNew(element_type, primary_dim_mm, std, overrides, extra);
      if (!result) result = await this.dispatchOld(element_type, primary_dim_mm, std, overrides, extra);
      comparisons[std] = {
        depth_mm: result.derived.depth_mm || result.derived.thickness_mm || result.derived.diameter_mm || 0,
        width_mm: result.derived.width_mm || 0,
        concrete_m3: result.quantities.concrete_volume_m3,
        formwork_m2: result.quantities.formwork_m2,
        reinforcement_kg: result.quantities.reinforcement_kg,
        rules_used: result.audit.map(a => a.rule_name)
      };
    }
    return {
      element_type,
      primary_dim_mm,
      comparisons,
      standards_compared: standards.filter(s => comparisons[s])
    };
  }

  async getRules(elementType, standard) {
    let query = supabase.from('parametric_rules').select('*');
    if (elementType) query = query.eq('element_type', elementType);
    if (standard) query = query.eq('standard', standard);
    const { data, error } = await query.order('element_type').order('priority');
    if (error) throw error;
    return data || [];
  }

  async getElements() {
    const { data, error } = await supabase.from('element_typologies').select('*').order('element_type');
    if (error) throw error;
    return data || [];
  }

  // eslint-disable-next-line no-unused-vars
  generateBoqLines(result, sectionId) {
    const lines = [];
    const et = result.element_type;
    const label = et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const std = result.standard.toUpperCase();
    const cat = this._boqCategory(et);

    lines.push({
      item_no: '1',
      description: `${cat} — ${label} (${std}): ${result.derived.depth_mm || result.derived.thickness_mm || result.derived.diameter_mm || ''} × ${result.derived.width_mm || ''} — concrete grade 25/30`,
      unit: 'm³',
      quantity: result.quantities.concrete_volume_m3,
      rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'concrete'
    });

    const fwDesc = result.quantities.formwork_breakdown
      ? Object.keys(result.quantities.formwork_breakdown).filter(k => k !== 'note' && k !== 'total_m2').join(', ')
      : 'all faces';
    lines.push({
      item_no: '2',
      description: `Sawn formwork to ${label} (${fwDesc})`,
      unit: 'm²',
      quantity: result.quantities.formwork_m2,
      rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'formwork'
    });

    const rebarTonne = result.quantities.reinforcement_kg / 1000;
    lines.push({
      item_no: '3',
      description: `Reinforcement steel (high yield, ${result.quantities.reinforcement_kg_per_m3 || 120} kg/m³ density) to ${label}`,
      unit: 'tonne',
      quantity: +rebarTonne.toFixed(4),
      rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'reinforcement'
    });

    const casc = result.cascade || {};
    if (casc.screed_volume_m3 > 0) {
      lines.push({
        item_no: '4', unit: 'm³',
        description: `Cement and sand screed (1:3, 75mm avg thickness) to ${label}`,
        quantity: casc.screed_volume_m3, rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'screed'
      });
    }
    if (casc.tiling_area_m2 > 0) {
      lines.push({
        item_no: '5', unit: 'm²',
        description: `Floor/wall tiling (incl. ${((1 - 1/1.05)*100).toFixed(0)}% cutting waste) to ${label}`,
        quantity: casc.tiling_area_m2, rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'tiling'
      });
    }
    if (casc.plaster_area_m2 > 0) {
      lines.push({
        item_no: '6', unit: 'm²',
        description: `Cement and sand plaster (1:4, 18mm thick) to exposed ${label} faces`,
        quantity: casc.plaster_area_m2, rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'plaster'
      });
    }
    if (casc.paint_area_m2 > 0) {
      lines.push({
        item_no: '7', unit: 'm²',
        description: `Emulsion paint (2 coats) to plastered ${label} surfaces`,
        quantity: casc.paint_area_m2, rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'paint'
      });
    }
    if (casc.skirting_length_m > 0) {
      lines.push({
        item_no: '8', unit: 'm',
        description: `Skirting (cement mortar 1:3, 150mm high) to ${label} perimeter`,
        quantity: casc.skirting_length_m, rate: 0, amount: 0, cost_class: 'measured_work', material_type: 'skirting'
      });
    }
    return lines;
  }

  _boqCategory(et) {
    const map = {
      beam: 'Reinforced concrete beam (in-situ)',
      column: 'Reinforced concrete column (in-situ)',
      slab: 'Reinforced concrete slab (in-situ)',
      staircase: 'Reinforced concrete staircase',
      footing: 'Reinforced concrete footing',
      wall: 'Reinforced concrete wall',
      circular_column: 'Reinforced concrete circular column',
      cylindrical_wall: 'Reinforced concrete cylindrical wall/tank',
      curved_beam: 'Reinforced concrete curved beam',
      dome_shell: 'Reinforced concrete dome shell'
    };
    return map[et] || `Reinforced concrete ${et}`;
  }

  async storeDerivedDimensions(result, userId, projectId, sessionLabel) {
    const et = result.element_type;
    const derived = result.derived || {};
    const quantities = result.quantities || {};
    const cascade = result.cascade || {};

    const { error } = await supabase.from('derived_dimensions').insert({
      user_id: userId,
      project_id: projectId || null,
      session_label: sessionLabel || `${et} calculation`,
      element_type: et,
      standard: result.standard,
      primary_dim: result.primary_dim,
      depth_mm: derived.depth_mm || null,
      width_mm: derived.width_mm || null,
      thickness_mm: derived.thickness_mm || null,
      height_mm: derived.height_m || null,
      length_mm: derived.length_m || null,
      concrete_volume_m3: quantities.concrete_volume_m3,
      formwork_m2: quantities.formwork_m2,
      formwork_breakdown: quantities.formwork_breakdown || null,
      reinforcement_kg: quantities.reinforcement_kg,
      reinforcement_kg_m3: quantities.reinforcement_kg_per_m3,
      plaster_area_m2: cascade.plaster_area_m2 || null,
      paint_area_m2: cascade.paint_area_m2 || null,
      screed_volume_m3: cascade.screed_volume_m3 || null,
      tiling_area_m2: cascade.tiling_area_m2 || null,
      skirting_length_m: cascade.skirting_length_m || null,
      overrides_applied: result.overrides_applied || [],
      warnings: result.warnings || [],
      raw_input: JSON.stringify({ element_type: et, primary_dim: result.primary_dim, standard: result.standard }),
      raw_output: JSON.stringify(result)
    });
    if (error) console.error('storeDerivedDimensions error:', error);
  }

  async storeAuditTrail(result, userId) {
    if (!result.audit || result.audit.length === 0) return;
    const records = result.audit.map(a => ({
      user_id: userId,
      element_type: result.element_type,
      standard: result.standard,
      rule_name: a.rule_name,
      input_value: a.input || null,
      computed_value: a.computed_value || null,
      formula_trace: a.formula_trace || null
    }));
    const { error } = await supabase.from('calculation_audits').insert(records);
    if (error) console.error('storeAuditTrail error:', error);
  }

  async storeCalculation({ project_id, typology_id, standard_code, inputs, result, user_id }) {
    const derived = result.derived || {};
    const quantities = result.quantities || {};
    const cascade = result.cascade || {};

    const { data, error } = await supabase.from('parametric_calculations').insert({
      project_id,
      typology_id: typology_id || null,
      standard_code: standard_code || result.standard,
      inputs: { ...inputs, element_type: result.element_type },
      derived_dimensions: derived,
      quantities,
      cascade,
      audit_log: result.audit || [],
      user_overrides: result.overrides_applied || [],
      warnings: result.warnings || [],
      waste_factors: result.waste_factors_applied || {},
      session_label: inputs?.session_label || `${result.element_type} calculation`,
      created_by: user_id
    }).select().single();

    if (error) {
      console.error('storeCalculation error:', error);
      return null;
    }

    return data;
  }

  async loadSavedSessions(userId, elementType, limit = 20) {
    let query = supabase
      .from('derived_dimensions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (elementType) query = query.eq('element_type', elementType);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async calculateWithWaste({ element_type, primary_dim_mm, standard, overrides, extra, user_id, project_id, session_label }) {
    const result = await this.calculate({ element_type, primary_dim_mm, standard, overrides, extra, user_id, project_id, session_label });

    const wasteFactors = { tile: 1.05, formwork_timber: 1.10, reinforcement: 1.05, concrete: 1.08, plaster: 1.05, paint: 1.05, screed: 1.05 };

    result.quantities.concrete_with_waste_m3 = +(result.quantities.concrete_volume_m3 * wasteFactors.concrete).toFixed(4);
    result.quantities.formwork_with_waste_m2 = +(result.quantities.formwork_m2 * wasteFactors.formwork_timber).toFixed(4);
    result.quantities.reinforcement_with_waste_kg = +(result.quantities.reinforcement_kg * wasteFactors.reinforcement).toFixed(3);

    const casc = result.cascade || {};
    result.cascade.screed_with_waste_m3 = casc.screed_volume_m3 ? +(casc.screed_volume_m3 * wasteFactors.screed).toFixed(4) : 0;
    result.cascade.tiling_with_waste_m2 = casc.tiling_area_m2 ? +(casc.tiling_area_m2 * wasteFactors.tile).toFixed(4) : 0;
    result.cascade.plaster_with_waste_m2 = casc.plaster_area_m2 ? +(casc.plaster_area_m2 * wasteFactors.plaster).toFixed(4) : 0;
    result.cascade.paint_with_waste_m2 = casc.paint_area_m2 ? +(casc.paint_area_m2 * wasteFactors.paint).toFixed(4) : 0;

    result.waste_factors_applied = wasteFactors;
    return result;
  }
}

module.exports = new ParametricEngine();
