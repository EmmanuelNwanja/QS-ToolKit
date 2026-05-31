const BaseElementRule = require('../BaseElementRule');

class CurvedBeamRule extends BaseElementRule {
  constructor() { super('beam'); }
  _configKey() { return 'curvedBeam'; }

  calculate_derived_dimensions() {
    const chordMm = this.ctx.primaryDimMm;
    const chordM = chordMm / 1000;
    const riseMm = this.ctx.extra.rise_mm || 0;
    const radiusM = this.ctx.extra.radius_m || 0;
    const angleDeg = this.ctx.extra.angle_deg || 0;

    let Rm = radiusM;
    let thetaRad = 0;
    let arcLengthM = 0;

    if (Rm > 0 && angleDeg > 0) {
      thetaRad = (angleDeg * Math.PI) / 180;
      arcLengthM = Rm * thetaRad;
    } else if (riseMm > 0) {
      const riseM = riseMm / 1000;
      Rm = (chordM * chordM) / (8 * riseM) + (riseM / 2);
      thetaRad = 2 * Math.asin(chordM / (2 * Rm));
      arcLengthM = Rm * thetaRad;
      this.audit('curved_beam_radius_from_chord_rise',
        `c=${chordM}m, h=${riseM}m`,
        `R=${this.round(Rm, 2)}m`,
        `R = (${chordM}² / 8×${riseM}) + ${riseM}/2 = ${this.round(Rm, 2)}m`);
    } else {
      Rm = chordM;
      arcLengthM = chordM;
      this.warn('No rise or radius provided — using chord length as arc length');
    }

    if (Rm > 0 && chordM > 0 && thetaRad === 0) {
      const halfAngle = Math.asin(Math.min(chordM / (2 * Rm), 1));
      thetaRad = 2 * halfAngle;
      if (arcLengthM === 0) arcLengthM = Rm * thetaRad;
    }

    const sdRatio = this.std('spanDepth', 12);
    const minDepth = this.std('minDepthMm', 200);
    const wRatio = this.std('widthRatio', { min: 2, max: 3 });
    const minWidth = this.std('minWidthMm', 150);
    const coverMm = this.std('coverMm', 30);
    const modularSizes = this.std('modularSizes', [150, 200, 225, 250, 300]);

    let depthMm = Math.max(Math.round(chordMm / sdRatio), minDepth);
    depthMm = this.resolveOverride('depth_mm', depthMm);

    let widthMm = Math.max(Math.round(depthMm / ((wRatio.min + wRatio.max) / 2)), minWidth);
    widthMm = this.modularRound(widthMm, modularSizes);
    widthMm = this.resolveOverride('width_mm', widthMm);

    this.audit('curved_beam_depth',
      `${chordMm}mm chord / ${sdRatio}`,
      depthMm,
      `h = max(chord/${sdRatio}, ${minDepth}) = ${depthMm}mm (conservative — uses chord)`);

    return {
      chord_length_m: this.round(chordM),
      rise_mm: riseMm,
      radius_m: this.round(Rm, 2),
      arc_length_m: this.round(arcLengthM),
      angle_deg: this.round(this.rad2deg(thetaRad), 1),
      depth_mm: depthMm,
      width_mm: widthMm,
      cover_mm: coverMm,
      span_to_depth_ratio: this.round(chordM / this.mmToM(depthMm), 2)
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    const depthM = this.mmToM(d.depth_mm);
    const widthM = this.mmToM(d.width_mm);
    return this.m3(depthM * widthM * d.arc_length_m);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const depthM = this.mmToM(d.depth_mm);
    const widthM = this.mmToM(d.width_mm);
    const arcL = d.arc_length_m;
    const soffit = this.m2(arcL * widthM);
    const sides = this.m2(2 * depthM * arcL);
    const radialEnds = this.m2(2 * depthM * widthM);
    return {
      soffit_curved_m2: soffit,
      sides_curved_m2: sides,
      radial_ends_m2: radialEnds,
      total_m2: this.m2(soffit + sides + radialEnds),
      note: 'Radial ends are non-rectangular; estimated as trapezoidal. Transferring to circular detailing.'
    };
  }

  calculate_reinforcement_weight() {
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 130);
    const d = this.calculate_derived_dimensions();
    this.warn(`Stirrups along curved beam — variable width along arc (R=${d.radius_m}m). Use detailed bar bending schedule.`);
    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const fw = this.calculate_formwork_area();
    const exposed = fw.total_m2;
    return {
      plaster_area_m2: this.round(exposed * 0.5),
      paint_area_m2: this.round(exposed * 0.5),
      screed_volume_m3: 0,
      tiling_area_m2: 0,
      skirting_length_m: 0
    };
  }

  rad2deg(rad) { return rad * 180 / Math.PI; }
}

module.exports = CurvedBeamRule;
