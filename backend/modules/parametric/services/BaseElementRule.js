const StandardsRegistry = require('./StandardsRegistry');
const supabase = require('../../../src/config/supabase');

class BaseElementRule {
  constructor(elementType) {
    this.elementType = elementType;
    this.auditTrail = [];
    this.warnings = [];
    this.overrides = [];
    this.ctx = null;
    this._stdConfig = null;
  }

  setContext(ctx) {
    this.ctx = ctx;
    this._stdConfig = StandardsRegistry.getElement(ctx.standard, this._configKey());
  }

  _configKey() { return this.elementType; }

  std(key, fallback) {
    if (!this._stdConfig) return fallback;
    return this._stdConfig[key] !== undefined ? this._stdConfig[key] : fallback;
  }

  stdNested(key1, key2, fallback) {
    const inner = this.std(key1, {});
    return inner[key2] !== undefined ? inner[key2] : fallback;
  }

  mmToM(v) { return v / 1000; }
  m2(v) { return +v.toFixed(4); }
  m3(v) { return +v.toFixed(4); }
  round(v, d) {
    if (d === undefined) d = this.elementType === 'dome_shell' ? 2 : 3;
    return +v.toFixed(d);
  }

  audit(ruleName, input, output, formulaTrace) {
    this.auditTrail.push({ rule_name: ruleName, input, computed_value: output, formula_trace: formulaTrace });
  }

  warn(message) { this.warnings.push(message); }

  override(fieldName, userValue, autoValue) {
    this.overrides.push({ field: fieldName, auto_value: autoValue, user_value: userValue });
  }

  resolveOverride(field, autoValue) {
    if (this.ctx && this.ctx.overrides[field] !== undefined && this.ctx.overrides[field] !== null) {
      this.override(field, this.ctx.overrides[field], autoValue);
      return this.ctx.overrides[field];
    }
    return autoValue;
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

  modularRound(value, sizes) {
    return StandardsRegistry.modularRound(value, sizes);
  }

  // ── Abstract methods (each rule overrides) ──────────────────
  calculate_derived_dimensions() {
    throw new Error(`${this.elementType} must implement calculate_derived_dimensions()`);
  }

  calculate_volume() {
    throw new Error(`${this.elementType} must implement calculate_volume()`);
  }

  calculate_formwork_area() {
    throw new Error(`${this.elementType} must implement calculate_formwork_area()`);
  }

  calculate_reinforcement_weight() {
    throw new Error(`${this.elementType} must implement calculate_reinforcement_weight()`);
  }

  calculate_finishes() {
    const concreteVol = this.calculate_volume();
    const fw = this.calculate_formwork_area();
    const exposedM2 = typeof fw === 'object' ? fw.total_m2 : fw;
    const results = { plaster_area_m2: 0, paint_area_m2: 0, screed_volume_m3: 0, tiling_area_m2: 0, skirting_length_m: 0 };
    results.plaster_area_m2 = this.round(exposedM2);
    results.paint_area_m2 = this.round(exposedM2);
    return results;
  }

  async calculate(ctx) {
    this.setContext(ctx);
    const derived = this.calculate_derived_dimensions();
    const concreteVolumeM3 = this.calculate_volume();
    const fw = this.calculate_formwork_area();
    const formworkM2 = typeof fw === 'object' ? fw.total_m2 : fw;
    const formworkBreakdown = typeof fw === 'object' ? fw : { total_m2: formworkM2 };
    const reinfKgPerM3 = this.std('rebarKgM3', 120);
    const reinforcementKg = this.round(concreteVolumeM3 * reinfKgPerM3);
    const finishes = this.calculate_finishes();

    return {
      element_type: this.elementType,
      standard: ctx.standard,
      primary_dim: ctx.primaryDimMm,
      primary_dim_label: ctx.getPrimaryDimLabel(),
      derived,
      quantities: {
        concrete_volume_m3: concreteVolumeM3,
        formwork_m2: formworkM2,
        formwork_breakdown: formworkBreakdown,
        reinforcement_kg: reinforcementKg,
        reinforcement_kg_per_m3: reinfKgPerM3
      },
      cascade: finishes,
      audit: this.auditTrail,
      warnings: this.warnings,
      overrides_applied: this.overrides
    };
  }
}

module.exports = BaseElementRule;
