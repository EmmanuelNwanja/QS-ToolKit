const BaseElementRule = require('../BaseElementRule');

class CircularColumnRule extends BaseElementRule {
  constructor() { super('column'); }
  _configKey() { return 'circularColumn'; }

  calculate_derived_dimensions() {
    const heightMm = this.ctx.primaryDimMm;
    const slabDropMm = this.ctx.extra.slab_thickness_mm || 150;
    const clearHeightMm = heightMm - slabDropMm;
    const stdDiameters = this.std('standardDiameters', [300, 450, 600, 900, 1200]);
    const minDia = this.std('minDiameterMm', 300);
    const coverMm = this.std('coverMm', 40);

    let diameterMm = this.modularRound(Math.max(minDia, minDia), stdDiameters);
    if (this.ctx.extra.diameter_mm) {
      diameterMm = this.ctx.extra.diameter_mm;
    } else {
      const heightRatio = this.std('heightRatio', { min: 10, max: 15 });
      const estDia = Math.max(Math.round(clearHeightMm / ((heightRatio.min + heightRatio.max) / 2)), minDia);
      diameterMm = this.modularRound(estDia, stdDiameters);
    }
    diameterMm = this.resolveOverride('diameter_mm', diameterMm);

    const heightM = this.round(clearHeightMm / 1000);
    const radiusM = this.mmToM(diameterMm) / 2;
    const crossSectionM2 = this.m2(Math.PI * radiusM * radiusM);

    this.audit('circular_column_diameter',
      `${clearHeightMm}mm height, selected diameter`,
      diameterMm,
      `D = ${diameterMm}mm, A = π×(${this.round(radiusM, 2)})² = ${crossSectionM2}m²`);

    return {
      diameter_mm: diameterMm,
      radius_m: this.round(radiusM, 2),
      height_m: heightM,
      clear_height_m: this.round(clearHeightMm / 1000),
      cross_section_area_m2: crossSectionM2,
      cover_mm: coverMm,
      slenderness: this.round(heightM / this.mmToM(diameterMm), 2)
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    const qty = this.ctx.quantity;
    return this.m3(d.cross_section_area_m2 * d.height_m * qty);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const qty = this.ctx.quantity;
    const circM = Math.PI * this.mmToM(d.diameter_mm);
    const area = this.m2(circM * d.height_m * qty);
    return {
      curved_surface_m2: area,
      circumference_m: this.round(circM),
      total_m2: area,
      note: 'Continuous curved formwork. No corners. Top/bottom masked.'
    };
  }

  calculate_reinforcement_weight() {
    const d = this.calculate_derived_dimensions();
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 160);
    const longBarSpacing = this.std('longBarSpacingMm', 200);
    const spiralPitch = this.std('spiralPitchMm', 100);
    const minBars = this.std('minLongBars', 6);
    const diaM = this.mmToM(d.diameter_mm);
    const coverM = this.mmToM(d.cover_mm);

    const noLongBars = Math.max(Math.floor(Math.PI * (diaM - 2 * coverM) / (longBarSpacing / 1000)) + 1, minBars);
    const spiralLenPerTieM = this.round(Math.PI * (diaM - coverM));
    const noTies = Math.ceil(d.height_m / (spiralPitch / 1000));

    const longBarLengthM = d.height_m * noLongBars;
    const tieLengthM = spiralLenPerTieM * noTies;
    const totalSteelM = longBarLengthM + tieLengthM;

    this.audit('circular_column_reinforcement',
      `D=${d.diameter_mm}mm, H=${d.height_m}m`,
      `${noLongBars} bars + ${noTies} spirals`,
      `n = max(π·(${this.round(diaM - 2*coverM, 2)})/${longBarSpacing/1000}+1, ${minBars}) = ${noLongBars}; spirals @${spiralPitch}mm = ${noTies}`);

    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const fw = this.calculate_formwork_area();
    const exposed = fw.total_m2;
    return {
      plaster_area_m2: this.round(exposed),
      paint_area_m2: this.round(exposed),
      tiling_area_m2: this.round(exposed * 1.05),
      screed_volume_m3: 0,
      skirting_length_m: 0
    };
  }
}

module.exports = CircularColumnRule;
