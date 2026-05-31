const { RuleStrategy } = require('../RuleStrategy');

class ColumnStrategy extends RuleStrategy {
  constructor() { super('column'); }

  async calculate(heightMm, standard = 'eurocode', overrides = {}, extra = {}) {
    const rules = await this.loadRules(standard);
    const heightM = this.mmToM(heightMm);

    const sizeRule = rules.find(r => r.rule_name === 'column_size_estimation');
    const minSizeRule = rules.find(r => r.rule_name === 'column_min_size');
    const coverRule = rules.find(r => r.rule_name === 'column_cover');

    const minSize = minSizeRule ? this.getParam(minSizeRule, 'min_size_mm', 230) : 230;

    let sizeMm = 0;
    if (sizeRule) {
      const minRatio = this.getParam(sizeRule, 'min_ratio', 10);
      const maxRatio = this.getParam(sizeRule, 'max_ratio', 15);
      const avgRatio = (minRatio + maxRatio) / 2;
      sizeMm = Math.max(Math.round(heightMm / avgRatio), minSize);
      sizeMm = Math.round(sizeMm / 25) * 25;
      this.audit(sizeRule.rule_name, `${heightMm}mm height / ${avgRatio}`, sizeMm,
        `b = max(height/${avgRatio}, ${minSize}mm) = ${sizeMm}mm [${sizeRule.code_reference}]`);
    } else {
      sizeMm = Math.max(Math.round(heightMm / 12), minSize);
    }

    if (overrides.width_mm) {
      this.override('width_mm', overrides.width_mm, sizeMm);
      sizeMm = overrides.width_mm;
    }

    const columnShape = extra.column_shape || 'square';
    let widthMm = sizeMm;
    let depthMm = sizeMm;
    if (columnShape === 'rectangular') {
      depthMm = Math.round(sizeMm * 1.5);
      if (overrides.depth_mm) {
        this.override('depth_mm', overrides.depth_mm, depthMm);
        depthMm = overrides.depth_mm;
      }
    }

    if (overrides.depth_mm && columnShape === 'square') {
      this.override('depth_mm', overrides.depth_mm, depthMm);
      depthMm = overrides.depth_mm;
    }

    const widthM = this.mmToM(widthMm);
    const depthM = this.mmToM(depthMm);
    const columnLengthM = extra.column_length_m || heightM;
    const coverMm = coverRule ? this.getParam(coverRule, 'cover_mm', 30) : 30;
    const columnQty = extra.quantity || 1;

    const concreteVolumeM3 = this.m3(depthM * widthM * columnLengthM * columnQty);

    const formworkM2 = this.m2(this.formworkPerimeter(widthM, depthM, columnLengthM) * columnQty);
    const formworkBreakdown = {
      vertical_faces_m2: formworkM2,
      top_m2: 0,
      note: 'Top excluded — supports slab/beam above. Bottom excluded — on footing.'
    };

    const kgPerM3 = this.rebarDensity(standard, rules);
    const reinforcementKg = this.round(concreteVolumeM3 * kgPerM3);

    const finishes = this.cascadeFinishes(concreteVolumeM3, formworkM2, 'column');

    return {
      element_type: 'column',
      standard,
      column_shape: columnShape,
      primary_dim: heightMm,
      primary_dim_label: 'Height (mm)',

      derived: {
        width_mm: widthMm,
        depth_mm: depthMm,
        height_m: this.round(columnLengthM),
        cover_mm: coverMm,
        height_to_min_size_ratio: this.round(heightM / Math.min(widthM, depthM), 2)
      },

      quantities: {
        concrete_volume_m3: concreteVolumeM3,
        formwork_m2: formworkM2,
        formwork_breakdown: formworkBreakdown,
        reinforcement_kg: reinforcementKg,
        reinforcement_kg_per_m3: kgPerM3,
        quantity: columnQty
      },

      cascade: finishes,

      audit: this.auditTrail,
      warnings: this.warnings,
      overrides_applied: this.overrides
    };
  }
}

module.exports = ColumnStrategy;
