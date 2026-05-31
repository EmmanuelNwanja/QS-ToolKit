const { RuleStrategy } = require('../RuleStrategy');

class WallStrategy extends RuleStrategy {
  constructor() { super('wall'); }

  async calculate(wallLengthMm, standard = 'eurocode', overrides = {}, extra = {}) {
    const rules = await this.loadRules(standard);
    const wallLengthM = this.mmToM(wallLengthMm);

    const minThicknessRule = rules.find(r => r.rule_name === 'wall_min_thickness');
    const minThickness = minThicknessRule
      ? this.getParam(minThicknessRule, 'min_thickness_mm', 150) : 150;

    let thicknessMm = minThickness;
    if (overrides.thickness_mm) {
      this.override('thickness_mm', overrides.thickness_mm, thicknessMm);
      thicknessMm = overrides.thickness_mm;
    }

    const wallHeightM = extra.wall_height_m || 3.0;
    const thicknessM = this.mmToM(thicknessMm);
    const qty = extra.quantity || 1;

    const concreteVolumeM3 = this.m3(thicknessM * wallHeightM * wallLengthM * qty);

    const bothSidesM2 = this.m2(2 * wallLengthM * wallHeightM * qty);
    const edgeM2 = this.m2(2 * thicknessM * wallHeightM * qty);

    const formworkBreakdown = {
      both_faces_m2: bothSidesM2,
      edges_m2: edgeM2,
      note: 'Both vertical faces require formwork. Top excluded — slab/beam above.'
    };

    const formworkM2 = this.m2(bothSidesM2 + edgeM2);

    const kgPerM3 = this.rebarDensity(standard, rules);
    const reinforcementKg = this.round(concreteVolumeM3 * kgPerM3);

    this.audit('wall_volume', `${thicknessM}m × ${wallHeightM}m × ${wallLengthM}m`, concreteVolumeM3,
      `V = t × h × L = ${concreteVolumeM3}m³`);

    const finishes = this.cascadeFinishes(concreteVolumeM3, bothSidesM2, 'wall');

    return {
      element_type: 'wall',
      standard,
      primary_dim: wallLengthMm,
      primary_dim_label: 'Length (mm)',

      derived: {
        thickness_mm: thicknessMm,
        height_m: this.round(wallHeightM),
        length_m: this.round(wallLengthM),
        slenderness_ratio: this.round(wallHeightM / thicknessM, 2)
      },

      quantities: {
        concrete_volume_m3: concreteVolumeM3,
        formwork_m2: formworkM2,
        formwork_breakdown: formworkBreakdown,
        reinforcement_kg: reinforcementKg,
        reinforcement_kg_per_m3: kgPerM3,
        quantity: qty
      },

      cascade: finishes,

      audit: this.auditTrail,
      warnings: this.warnings,
      overrides_applied: this.overrides
    };
  }
}

module.exports = WallStrategy;
