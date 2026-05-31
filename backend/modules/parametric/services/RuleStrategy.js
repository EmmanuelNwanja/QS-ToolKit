const supabase = require('../../../src/config/supabase');

const STANDARDS = {
  EUROCODE: 'eurocode',
  ACI: 'aci',
  IS456: 'is456',
  BS8110: 'bs8110',
  INTERNATIONAL: 'international'
};

class RuleStrategy {
  constructor(elementType) {
    this.elementType = elementType;
    this.auditTrail = [];
    this.warnings = [];
    this.overrides = [];
  }

  getSupportedStandards() {
    return Object.values(STANDARDS);
  }

  async loadRules(standard) {
    const { data, error } = await supabase
      .from('parametric_rules')
      .select('*')
      .eq('element_type', this.elementType)
      .eq('standard', standard)
      .order('priority', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  getParam(rule, key, fallback) {
    if (!rule || !rule.parameters) return fallback;
    return rule.parameters[key] !== undefined ? rule.parameters[key] : fallback;
  }

  audit(ruleName, input, output, formulaTrace) {
    this.auditTrail.push({ rule_name: ruleName, input, computed_value: output, formula_trace: formulaTrace });
  }

  warn(message) {
    this.warnings.push(message);
  }

  override(fieldName, userValue, autoValue) {
    this.overrides.push({ field: fieldName, auto_value: autoValue, user_value: userValue });
  }

  mmToM(v) { return v / 1000; }

  m2(v) { return +v.toFixed(4); }

  m3(v) { return +v.toFixed(4); }

  round(v, d = 3) { return +v.toFixed(d); }

  calculate(primaryDimMm, standard, overrides = {}, extra = {}) {
    throw new Error(`Strategy for ${this.elementType} must implement calculate()`);
  }

  async dispatch(elementType, primaryDimMm, standard, overrides = {}, extra = {}) {
    const strategies = {
      beam:     () => new (require('./strategies/BeamStrategy'))(),
      column:   () => new (require('./strategies/ColumnStrategy'))(),
      slab:     () => new (require('./strategies/SlabStrategy'))(),
      footing:  () => new (require('./strategies/FootingStrategy'))(),
      wall:     () => new (require('./strategies/WallStrategy'))()
    };
    const factory = strategies[elementType];
    if (!factory) throw new Error(`Unsupported element type: ${elementType}`);
    return factory().calculate(primaryDimMm, standard, overrides, extra);
  }

  rebarDensity(standard, rules) {
    const rule = rules.find(r => r.rule_name === `${this.elementType}_reinf_density`);
    return rule ? this.getParam(rule, 'kg_per_m3', 120) : 120;
  }

  formworkSideForms(depthM, lengthM) {
    return this.m2(2 * depthM * lengthM);
  }

  formworkSoffit(widthM, lengthM) {
    return this.m2(widthM * lengthM);
  }

  formworkPerimeter(widthM, depthM, heightM) {
    return this.m2(2 * (widthM + depthM) * heightM);
  }

  cascadeFinishes(concreteVolumeM3, exposedAreaM2, elementType) {
    const results = {};
    results.plaster_area_m2 = this.round(exposedAreaM2 * 1.0);
    results.paint_area_m2 = this.round(exposedAreaM2 * 1.0);
    if (elementType === 'slab') {
      const screedThicknessM = 0.075;
      results.screed_volume_m3 = this.round(exposedAreaM2 * screedThicknessM);
      results.tiling_area_m2 = this.round(exposedAreaM2 * 1.05);
      results.skirting_length_m = 0;
    } else if (elementType === 'beam') {
      results.screed_volume_m3 = 0;
      results.tiling_area_m2 = 0;
      results.skirting_length_m = 0;
    } else if (elementType === 'column') {
      results.screed_volume_m3 = 0;
      results.tiling_area_m2 = this.round(exposedAreaM2 * 1.05);
      results.skirting_length_m = 0;
    } else {
      results.screed_volume_m3 = 0;
      results.tiling_area_m2 = 0;
      results.skirting_length_m = this.round(exposedAreaM2 > 0 ? exposedAreaM2 / (2 * 1) : 0);
    }
    return results;
  }
}

module.exports = { RuleStrategy, STANDARDS };
