const { RuleStrategy } = require('../RuleStrategy');

class BeamStrategy extends RuleStrategy {
  constructor() { super('beam'); }

  async calculate(spanMm, standard = 'eurocode', overrides = {}, extra = {}) {
    const rules = await this.loadRules(standard);
    const spanM = this.mmToM(spanMm);
    const supportType = extra.support_type || 'simply_supported';
    const beamType = extra.beam_type || 'lateral';  // lateral | isolated

    const depthRule = rules.find(r =>
      r.rule_name === `beam_min_depth_${supportType}`
    );
    const widthRule = rules.find(r => r.rule_name === 'beam_width_ratio');
    const coverRule = rules.find(r => r.rule_name === 'beam_cover');

    let depthMm = 0;
    if (depthRule) {
      const ratio = this.getParam(depthRule, 'ratio', 12);
      const minDepth = this.getParam(depthRule, 'min_depth_mm', 200);
      depthMm = Math.max(Math.round(spanMm / ratio), minDepth);
      this.audit(depthRule.rule_name, `${spanMm}mm span / ${ratio}`, depthMm,
        `h = max(span/${ratio}, ${minDepth}mm) = ${depthMm}mm [${depthRule.code_reference}]`);
    } else {
      depthMm = Math.max(Math.round(spanMm / 12), 200);
    }

    if (overrides.depth_mm) {
      this.override('depth_mm', overrides.depth_mm, depthMm);
      depthMm = overrides.depth_mm;
    }

    let widthMm = 0;
    if (widthRule) {
      const minRatio = this.getParam(widthRule, 'min_ratio', 2);
      const maxRatio = this.getParam(widthRule, 'max_ratio', 3);
      const minWidth = this.getParam(widthRule, 'min_width_mm', 150);
      const avgRatio = (minRatio + maxRatio) / 2;
      widthMm = Math.max(Math.round(depthMm / avgRatio), minWidth);
      widthMm = Math.round(widthMm / 25) * 25;
      this.audit(widthRule.rule_name, `${depthMm}mm depth / ${avgRatio}`, widthMm,
        `b = max(depth/${avgRatio}, ${minWidth}mm) = ${widthMm}mm [${widthRule.code_reference}]`);
    } else {
      widthMm = Math.max(Math.round(depthMm / 2), 150);
    }

    if (overrides.width_mm) {
      this.override('width_mm', overrides.width_mm, widthMm);
      widthMm = overrides.width_mm;
    }

    const depthM = this.mmToM(depthMm);
    const widthM = this.mmToM(widthMm);
    const lengthM = extra.length_m || this.getBeamLength(spanMm);
    const coverMm = coverRule ? this.getParam(coverRule, 'cover_mm', 30) : 30;

    const concreteVolumeM3 = this.m3(depthM * widthM * lengthM);

    let formworkM2, formworkBreakdown;
    if (beamType === 'isolated') {
      const sidesM2 = this.formworkSideForms(depthM, lengthM);
      const soffitM2 = this.formworkSoffit(widthM, lengthM);
      formworkM2 = this.m2(sidesM2 + soffitM2);
      formworkBreakdown = { sides_m2: sidesM2, soffit_m2: soffitM2, top_m2: 0 };
    } else {
      const sidesM2 = this.formworkSideForms(depthM, lengthM);
      formworkM2 = sidesM2;
      formworkBreakdown = { sides_m2: sidesM2, soffit_m2: 0, top_m2: 0,
        note: 'Top excluded — cast against slab. Soffit excluded — cast against wall/beam.' };
    }

    const kgPerM3 = this.rebarDensity(standard, rules);
    const reinforcementKg = this.round(concreteVolumeM3 * kgPerM3);

    const finishes = this.cascadeFinishes(concreteVolumeM3, formworkM2, 'beam');

    return {
      element_type: 'beam',
      standard,
      support_type: supportType,
      beam_type: beamType,
      primary_dim: spanMm,
      primary_dim_label: 'Span (mm)',

      derived: {
        depth_mm: depthMm,
        width_mm: widthMm,
        length_m: this.round(lengthM),
        cover_mm: coverMm,
        span_to_depth_ratio: this.round(spanM / depthM, 2)
      },

      quantities: {
        concrete_volume_m3: concreteVolumeM3,
        formwork_m2: formworkM2,
        formwork_breakdown: formworkBreakdown,
        reinforcement_kg: reinforcementKg,
        reinforcement_kg_per_m3: kgPerM3
      },

      cascade: finishes,

      audit: this.auditTrail,
      warnings: this.warnings,
      overrides_applied: this.overrides
    };
  }

  getBeamLength(spanMm) {
    const spanM = this.mmToM(spanMm);
    return spanM + 0.6;
  }
}

module.exports = BeamStrategy;
