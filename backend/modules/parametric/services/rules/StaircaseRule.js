const BaseElementRule = require('../BaseElementRule');

class StaircaseRule extends BaseElementRule {
  constructor() { super('staircase'); }

  calculate_derived_dimensions() {
    const waistSpanMm = this.ctx.primaryDimMm;
    const ratio = this.std('waistSpanDepth', 20);
    const minWaist = this.std('minWaistMm', 100);

    let waistMm = Math.max(Math.round(waistSpanMm / ratio), minWaist);
    this.audit('staircase_waist_thickness',
      `${waistSpanMm}mm waist span / ${ratio}`,
      waistMm,
      `h_waist = max(${waistSpanMm}/${ratio}, ${minWaist}) = ${waistMm}mm`);

    waistMm = this.resolveOverride('waist_mm', waistMm);

    const stairWidthM = this.ctx.extra.stair_width_m || 1.2;
    const treadMm = this.ctx.extra.tread_mm || this.std('treadMm', 270);
    const riserMm = this.ctx.extra.riser_mm || this.std('riserMm', 150);
    const noRisers = this.ctx.extra.no_risers || Math.round(waistSpanMm / riserMm);
    const waistLengthM = this.ctx.extra.waist_length_m || (waistSpanMm / 1000);
    const landingLengthM = this.ctx.extra.landing_length_m || 1.2;
    const landingWidthM = this.ctx.extra.landing_width_m || stairWidthM;
    const coverMm = this.std('coverMm', 25);
    const goingMm = (noRisers - 1) * treadMm;

    return {
      waist_thickness_mm: waistMm,
      stair_width_m: this.round(stairWidthM),
      tread_mm: treadMm,
      riser_mm: riserMm,
      no_risers: noRisers,
      going_mm: goingMm,
      waist_slope_length_m: this.round(waistLengthM),
      landing_length_m: this.round(landingLengthM),
      landing_width_m: this.round(landingWidthM),
      cover_mm: coverMm
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    const waistM = this.mmToM(d.waist_thickness_mm);
    const waistVol = this.m3(waistM * d.stair_width_m * d.waist_slope_length_m);
    const landingVol = this.m3(waistM * d.landing_length_m * d.landing_width_m);
    const riserVol = this.m3(0.5 * this.mmToM(d.riser_mm) * this.mmToM(d.tread_mm) * d.stair_width_m * d.no_risers);
    return this.m3(waistVol + landingVol + riserVol);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const w = d.stair_width_m;
    const waistL = d.waist_slope_length_m;
    const lL = d.landing_length_m;
    const lW = d.landing_width_m;
    const riserM = this.mmToM(d.riser_mm);
    const treadM = this.mmToM(d.tread_mm);
    const noR = d.no_risers;
    const waistThickM = this.mmToM(d.waist_thickness_mm);

    const waistSoffit = this.m2(w * waistL);
    const landingSoffit = this.m2(lL * lW);
    const riserFaces = this.m2(noR * riserM * w);
    const treadFaces = this.m2((noR - 1) * treadM * w);
    const stringerSides = this.m2(2 * waistL * (riserM + treadM + waistThickM));
    const landingEdges = this.m2(2 * (lL + lW) * waistThickM);
    const total = this.m2(waistSoffit + landingSoffit + riserFaces + treadFaces + stringerSides + landingEdges);

    return {
      waist_soffit_m2: waistSoffit,
      landing_soffit_m2: landingSoffit,
      riser_faces_m2: riserFaces,
      tread_faces_m2: treadFaces,
      stringer_sides_m2: stringerSides,
      landing_edges_m2: landingEdges,
      total_m2: total,
      note: 'Includes waist soffit, landing soffit, riser/tread faces, stringer sides, and landing edges.'
    };
  }

  calculate_reinforcement_weight() {
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 110);
    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const d = this.calculate_derived_dimensions();
    const w = d.stair_width_m;
    const waistL = d.waist_slope_length_m;
    const lL = d.landing_length_m;
    const lW = d.landing_width_m;
    const treadM = this.mmToM(d.tread_mm);
    const riserM = this.mmToM(d.riser_mm);
    const noR = d.no_risers;
    const finishAreaM2 = this.m2((w * waistL) + (lL * lW) + (noR * riserM * w) + ((noR - 1) * treadM * w));
    return {
      plaster_area_m2: this.round(finishAreaM2 * 1.0),
      paint_area_m2: this.round(finishAreaM2 * 1.0),
      screed_volume_m3: 0,
      tiling_area_m2: this.round(finishAreaM2 * 1.05),
      skirting_length_m: 0
    };
  }
}

module.exports = StaircaseRule;
