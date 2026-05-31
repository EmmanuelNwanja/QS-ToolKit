const { RuleStrategy } = require('../RuleStrategy');

class SlabStrategy extends RuleStrategy {
  constructor() { super('slab'); }

  async calculate(spanMm, standard = 'eurocode', overrides = {}, extra = {}) {
    const rules = await this.loadRules(standard);
    const spanM = this.mmToM(spanMm);
    const slabType = extra.slab_type || 'one_way';  // one_way | two_way

    const thicknessRule = rules.find(r =>
      r.rule_name === `slab_min_thickness_${slabType}`
    );

    let thicknessMm = 0;
    if (thicknessRule) {
      const ratio = this.getParam(thicknessRule, 'ratio', 30);
      const minThickness = this.getParam(thicknessRule, 'min_thickness_mm', 120);
      thicknessMm = Math.max(Math.round(spanMm / ratio), minThickness);
      this.audit(thicknessRule.rule_name, `${spanMm}mm span / ${ratio}`, thicknessMm,
        `h = max(span/${ratio}, ${minThickness}mm) = ${thicknessMm}mm [${thicknessRule.code_reference}]`);
    } else {
      thicknessMm = Math.max(Math.round(spanMm / 30), 120);
    }

    if (overrides.thickness_mm) {
      this.override('thickness_mm', overrides.thickness_mm, thicknessMm);
      thicknessMm = overrides.thickness_mm;
    }

    const thicknessM = this.mmToM(thicknessMm);
    const slabLengthM = extra.slab_length_m || spanM;
    const slabWidthM = extra.slab_width_m || spanM * (slabType === 'two_way' ? 1.0 : 0.5);
    const coverRule = rules.find(r => r.rule_name === 'slab_cover');
    const coverMm = coverRule ? this.getParam(coverRule, 'cover_mm', 25) : 25;

    const concreteVolumeM3 = this.m3(thicknessM * slabLengthM * slabWidthM);

    const soffitM2 = this.m2(slabLengthM * slabWidthM);
    const formworkM2 = soffitM2;
    const formworkBreakdown = {
      soffit_m2: soffitM2,
      edges_m2: this.m2(2 * thicknessM * (slabLengthM + slabWidthM)),
      top_m2: 0,
      note: 'Top surface excluded — walking/finished surface.'
    };

    const kgPerM3 = this.rebarDensity(standard, rules);
    const reinforcementKg = this.round(concreteVolumeM3 * kgPerM3);

    const finishes = this.cascadeFinishes(concreteVolumeM3, soffitM2, 'slab');

    return {
      element_type: 'slab',
      standard,
      slab_type: slabType,
      primary_dim: spanMm,
      primary_dim_label: 'Span (mm)',

      derived: {
        thickness_mm: thicknessMm,
        length_m: this.round(slabLengthM),
        width_m: this.round(slabWidthM),
        cover_mm: coverMm,
        span_to_depth_ratio: this.round(spanM / thicknessM, 2)
      },

      quantities: {
        concrete_volume_m3: concreteVolumeM3,
        formwork_m2: formworkM2,
        formwork_breakdown: formworkBreakdown,
        reinforcement_kg: reinforcementKg,
        reinforcement_kg_per_m3: kgPerM3
      },

      cascade: {
        plaster_area_m2: this.round(finishes.plaster_area_m2),
        paint_area_m2: this.round(finishes.paint_area_m2),
        screed_volume_m3: finishes.screed_volume_m3,
        tiling_area_m2: finishes.tiling_area_m2,
        skirting_length_m: this.round(2 * (slabLengthM + slabWidthM))
      },

      audit: this.auditTrail,
      warnings: this.warnings,
      overrides_applied: this.overrides
    };
  }
}

module.exports = SlabStrategy;
