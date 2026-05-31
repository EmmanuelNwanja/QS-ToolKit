const { RuleStrategy } = require('../RuleStrategy');

class FootingStrategy extends RuleStrategy {
  constructor() { super('footing'); }

  async calculate(columnLoadMm, standard = 'eurocode', overrides = {}, extra = {}) {
    const rules = await this.loadRules(standard);
    const columnLoadM = this.mmToM(columnLoadMm);

    const minThicknessRule = rules.find(r => r.rule_name === 'footing_min_base_thickness');
    const minThickness = minThicknessRule
      ? this.getParam(minThicknessRule, 'min_thickness_mm', 200) : 200;

    let thicknessMm = minThickness;
    if (overrides.thickness_mm) {
      this.override('thickness_mm', overrides.thickness_mm, thicknessMm);
      thicknessMm = overrides.thickness_mm;
    }

    const colWidthM = extra.column_width_m || 0.3;
    const colDepthM = extra.column_depth_m || 0.3;
    const minProjectionM = 0.3;

    const baseWidthM = colWidthM + 2 * minProjectionM;
    const baseDepthM = colDepthM + 2 * minProjectionM;
    const projectionM = minProjectionM;

    const thicknessM = this.mmToM(thicknessMm);
    const qty = extra.quantity || 1;

    const concreteVolumeM3 = this.m3(thicknessM * baseWidthM * baseDepthM * qty);

    const edgeFormworkM2 = this.m2(2 * (baseWidthM + baseDepthM) * thicknessM * qty);
    const formworkBreakdown = {
      edge_formwork_m2: edgeFormworkM2,
      blinding_m2: this.m2(baseWidthM * baseDepthM * qty),
      note: 'Top excluded — column sits above. Bottom excluded — blinding concrete.'
    };

    const kgPerM3 = this.rebarDensity(standard, rules);
    const reinforcementKg = this.round(concreteVolumeM3 * kgPerM3);

    this.audit('footing_base_sizing', `${columnLoadMm}mm + 2×300mm projection`,
      `${baseWidthM}m × ${baseDepthM}m`,
      `B = col_width + 2 × ${minProjectionM}m = ${baseWidthM}m [${minThicknessRule ? minThicknessRule.code_reference : 'Standard practice'}]`);

    const finishes = this.cascadeFinishes(concreteVolumeM3, 0, 'footing');
    const excavationVolumeM3 = this.m3((thicknessM + 0.1) * (baseWidthM + 0.6) * (baseDepthM + 0.6) * qty);

    return {
      element_type: 'footing',
      standard,
      primary_dim: columnLoadMm,
      primary_dim_label: 'Column size (mm)',

      derived: {
        base_width_m: this.round(baseWidthM),
        base_depth_m: this.round(baseDepthM),
        thickness_mm: thicknessMm,
        projection_m: this.round(projectionM),
        column_width_m: this.round(colWidthM),
        column_depth_m: this.round(colDepthM)
      },

      quantities: {
        concrete_volume_m3: concreteVolumeM3,
        formwork_m2: edgeFormworkM2,
        formwork_breakdown: formworkBreakdown,
        reinforcement_kg: reinforcementKg,
        reinforcement_kg_per_m3: kgPerM3,
        excavation_volume_m3: excavationVolumeM3,
        blinding_volume_m3: this.m3(0.075 * baseWidthM * baseDepthM * qty),
        quantity: qty
      },

      cascade: finishes,

      audit: this.auditTrail,
      warnings: this.warnings,
      overrides_applied: this.overrides
    };
  }
}

module.exports = FootingStrategy;
