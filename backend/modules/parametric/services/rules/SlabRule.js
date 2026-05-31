const BaseElementRule = require('../BaseElementRule');

class SlabRule extends BaseElementRule {
  constructor() { super('slab'); }

  calculate_derived_dimensions() {
    const spanMm = this.ctx.primaryDimMm;
    const spanM = this.ctx.getSpanM();
    const slabType = this.ctx.slabType || 'one_way';
    const ratio = this.stdNested('spanDepth', slabType, 30);
    const minThick = this.std('minThicknessMm', 120);

    let thicknessMm = Math.max(Math.round(spanMm / ratio), minThick);
    this.audit('slab_thickness_from_span',
      `${spanMm}mm span, ${slabType}, span/${ratio}`,
      thicknessMm,
      `h = max(${spanMm}/${ratio}, ${minThick}) = ${thicknessMm}mm [${this.std('code', 'EC2')}]`);

    thicknessMm = this.resolveOverride('thickness_mm', thicknessMm);

    const slabLengthM = this.ctx.extra.slab_length_m || spanM;
    const slabWidthM = this.ctx.extra.slab_width_m || (slabType === 'two_way' ? spanM : spanM * 0.5);
    const coverMm = this.std('coverMm', 25);

    return {
      thickness_mm: thicknessMm,
      length_m: this.round(slabLengthM),
      width_m: this.round(slabWidthM),
      cover_mm: coverMm,
      span_to_depth_ratio: this.round(spanM / this.mmToM(thicknessMm), 2),
      slab_type: slabType
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    return this.m3(this.mmToM(d.thickness_mm) * d.length_m * d.width_m);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const soffitM2 = this.m2(d.length_m * d.width_m);
    const thickM = this.mmToM(d.thickness_mm);
    const edgesM2 = this.m2(2 * thickM * (d.length_m + d.width_m));
    return {
      soffit_m2: soffitM2,
      edges_m2: edgesM2,
      total_m2: this.m2(soffitM2 + edgesM2),
      note: 'Soffit formed. Top surface excluded — finished walking surface. Edges require side shuttering.'
    };
  }

  calculate_reinforcement_weight() {
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 100);
    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const d = this.calculate_derived_dimensions();
    const areaM2 = d.length_m * d.width_m;
    return {
      plaster_area_m2: 0,
      paint_area_m2: 0,
      screed_volume_m3: this.round(areaM2 * 0.075),
      tiling_area_m2: this.round(areaM2 * 1.05),
      skirting_length_m: this.round(2 * (d.length_m + d.width_m))
    };
  }
}

module.exports = SlabRule;
