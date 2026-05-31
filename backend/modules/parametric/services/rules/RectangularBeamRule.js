const BaseElementRule = require('../BaseElementRule');

class RectangularBeamRule extends BaseElementRule {
  constructor() { super('beam'); }

  calculate_derived_dimensions() {
    const spanMm = this.ctx.primaryDimMm;
    const spanM = this.ctx.getSpanM();
    const supportType = this.ctx.supportType || 'simply_supported';

    const ratio = this.stdNested('spanDepth', supportType, 12);
    const minDepth = this.std('minDepthMm', 200);
    const minWidth = this.std('minWidthMm', 150);
    const wRatio = this.std('widthRatio', { min: 2, max: 3 });
    const modularSizes = this.std('modularSizes', [150, 200, 225, 250, 300]);

    let depthMm = Math.max(Math.round(spanMm / ratio), minDepth);
    this.audit('beam_depth_from_span',
      `${spanMm}mm span, ${supportType}, span/${ratio}`,
      depthMm,
      `h = max(${spanMm}/${ratio}, ${minDepth}) = ${depthMm}mm`);

    let widthMm = Math.max(Math.round(depthMm / ((wRatio.min + wRatio.max) / 2)), minWidth);
    widthMm = this.modularRound(widthMm, modularSizes);
    this.audit('beam_width_from_depth',
      `${depthMm}mm depth, avg ratio ${(wRatio.min + wRatio.max) / 2}`,
      widthMm,
      `b = round(max(depth/avg_ratio, ${minWidth})) = ${widthMm}mm`);

    depthMm = this.resolveOverride('depth_mm', depthMm);
    widthMm = this.resolveOverride('width_mm', widthMm);

    const lengthM = this.round(spanM + 0.6);
    const depthM = this.mmToM(depthMm);
    const widthM = this.mmToM(widthMm);
    const coverMm = this.std('coverMm', 30);

    return {
      depth_mm: depthMm,
      width_mm: widthMm,
      length_m: lengthM,
      cover_mm: coverMm,
      span_to_depth_ratio: this.round(spanM / depthM, 2)
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    return this.m3(this.mmToM(d.depth_mm) * this.mmToM(d.width_mm) * d.length_m);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const depthM = this.mmToM(d.depth_mm);
    const widthM = this.mmToM(d.width_mm);
    const lengthM = d.length_m;
    const beamType = this.ctx.beamType || 'lateral';

    if (beamType === 'isolated') {
      const sides = this.m2(2 * depthM * lengthM);
      const soffit = this.m2(widthM * lengthM);
      return {
        sides_m2: sides,
        soffit_m2: soffit,
        top_m2: 0,
        total_m2: this.m2(sides + soffit),
        note: 'All faces formed (isolated beam). Top excluded — compression flange.'
      };
    }
    const sides = this.m2(2 * depthM * lengthM);
    return {
      sides_m2: sides,
      soffit_m2: 0,
      top_m2: 0,
      total_m2: sides,
      note: 'Sides only. Soffit excluded (cast against formwork below). Top excluded (cast with slab).'
    };
  }

  calculate_reinforcement_weight() {
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 120);
    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const fw = this.calculate_formwork_area();
    const exposed = fw.total_m2;
    return {
      plaster_area_m2: this.round(exposed),
      paint_area_m2: this.round(exposed),
      screed_volume_m3: 0,
      tiling_area_m2: 0,
      skirting_length_m: 0
    };
  }
}

module.exports = RectangularBeamRule;
