const BaseElementRule = require('../BaseElementRule');

class CylindricalWallRule extends BaseElementRule {
  constructor() { super('wall'); }
  _configKey() { return 'cylindricalWall'; }

  calculate_derived_dimensions() {
    const internalDiaMm = this.ctx.primaryDimMm;
    const totalHeightM = this.ctx.extra.wall_height_m || 3.0;
    const wallThicknessRatio = this.std('wallThicknessRatio', 40);
    const minThickness = this.std('minThicknessMm', 150);

    let thicknessMm = Math.max(Math.round(internalDiaMm / wallThicknessRatio), minThickness);
    this.audit('cylindrical_wall_thickness',
      `Dᵢ=${internalDiaMm}mm / ${wallThicknessRatio}`,
      thicknessMm,
      `t = max(Dᵢ/${wallThicknessRatio}, ${minThickness}) = ${thicknessMm}mm`);

    thicknessMm = this.resolveOverride('thickness_mm', thicknessMm);

    const externalDiaMm = internalDiaMm + 2 * thicknessMm;
    const internalRadiusM = this.mmToM(internalDiaMm) / 2;
    const externalRadiusM = this.mmToM(externalDiaMm) / 2;
    const thicknessM = this.mmToM(thicknessMm);
    const coverMm = this.std('coverMm', 40);
    const qty = this.ctx.quantity;

    return {
      internal_diameter_mm: internalDiaMm,
      external_diameter_mm: externalDiaMm,
      thickness_mm: thicknessMm,
      internal_radius_m: this.round(internalRadiusM),
      external_radius_m: this.round(externalRadiusM),
      height_m: totalHeightM,
      cover_mm: coverMm,
      quantity: qty,
      diameter_to_thickness_ratio: this.round(internalDiaMm / thicknessMm, 1)
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    const qty = d.quantity;
    const annulusM2 = this.m2(Math.PI * (d.external_radius_m * d.external_radius_m - d.internal_radius_m * d.internal_radius_m));
    return this.m3(annulusM2 * d.height_m * qty);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const qty = d.quantity;
    const externalCircM = Math.PI * this.mmToM(d.external_diameter_mm);
    const internalCircM = Math.PI * this.mmToM(d.internal_diameter_mm);
    const externalFormwork = this.m2(externalCircM * d.height_m * qty);
    const internalFormwork = this.m2(internalCircM * d.height_m * qty);
    const edgeFormwork = this.m2(2 * Math.PI * this.mmToM(d.thickness_mm) * d.height_m * qty);

    this.audit('cylindrical_wall_formwork',
      `Dₒ=${d.external_diameter_mm}mm, Dᵢ=${d.internal_diameter_mm}mm, H=${d.height_m}m`,
      `ext=${externalFormwork}m², int=${internalFormwork}m²`,
      `A_ext = π×${this.round(this.mmToM(d.external_diameter_mm))}×${d.height_m} = ${externalFormwork}m²; A_int similar`);

    return {
      external_m2: externalFormwork,
      internal_m2: internalFormwork,
      edges_m2: edgeFormwork,
      total_m2: this.m2(externalFormwork + internalFormwork + edgeFormwork),
      note: 'Both internal and external curved surfaces require formwork. Cylindrical tanks/silos.'
    };
  }

  calculate_reinforcement_weight() {
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 120);
    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const d = this.calculate_derived_dimensions();
    const externalAreaM2 = Math.PI * this.mmToM(d.external_diameter_mm) * d.height_m * d.quantity;
    const internalAreaM2 = Math.PI * this.mmToM(d.internal_diameter_mm) * d.height_m * d.quantity;
    const totalFinishAreaM2 = this.m2(externalAreaM2 + internalAreaM2);
    return {
      plaster_area_m2: this.round(totalFinishAreaM2),
      paint_area_m2: this.round(totalFinishAreaM2 * 2),
      tiling_area_m2: this.round(internalAreaM2 * 1.05),
      screed_volume_m3: 0,
      skirting_length_m: 0
    };
  }
}

module.exports = CylindricalWallRule;
