const BaseElementRule = require('../BaseElementRule');

class DomeShellRule extends BaseElementRule {
  constructor() { super('slab'); }
  _configKey() { return 'domeShell'; }

  calculate_derived_dimensions() {
    const baseDiaMm = this.ctx.primaryDimMm;
    const baseDiaM = baseDiaMm / 1000;
    const riseM = this.ctx.extra.rise_m || (baseDiaM / 4);
    const thicknessRatio = this.std('thicknessRatio', 60);
    const minThickness = this.std('minThicknessMm', 75);

    let thicknessMm = Math.max(Math.round(baseDiaMm / thicknessRatio), minThickness);
    thicknessMm = this.resolveOverride('thickness_mm', thicknessMm);

    const radiusM = (baseDiaM / 2);
    const sphereRadiusM = (radiusM * radiusM + riseM * riseM) / (2 * riseM);
    const surfaceAreaM2 = this.m2(2 * Math.PI * sphereRadiusM * riseM);
    const baseCircM = this.m2(Math.PI * baseDiaM);
    const thicknessM = this.mmToM(thicknessMm);

    this.audit('dome_shell_geometry',
      `D=${baseDiaM}m, h=${riseM}m`,
      `R_sph=${this.round(sphereRadiusM, 2)}m, A=${surfaceAreaM2}m²`,
      `R = ((${radiusM})² + ${riseM}²) / (2×${riseM}) = ${this.round(sphereRadiusM, 2)}m; SA = 2π·R·h = ${surfaceAreaM2}m²`);

    return {
      base_diameter_m: this.round(baseDiaM),
      rise_m: this.round(riseM),
      sphere_radius_m: this.round(sphereRadiusM, 2),
      surface_area_m2: surfaceAreaM2,
      thickness_mm: thicknessMm,
      base_circumference_m: baseCircM,
      rise_to_diameter_ratio: this.round(riseM / baseDiaM, 2),
      thin_shell: thicknessMm <= 100
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    return this.m3(d.surface_area_m2 * this.mmToM(d.thickness_mm));
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const thickM = this.mmToM(d.thickness_mm);
    const edgeFormwork = this.m2(d.base_circumference_m * thickM);
    return {
      soffit_curved_m2: d.surface_area_m2,
      edge_formwork_m2: edgeFormwork,
      total_m2: this.m2(d.surface_area_m2 + edgeFormwork),
      note: 'Specialist centering required for spherical soffit. Standard props not applicable — use purpose-built timber/steel trusses.'
    };
  }

  calculate_reinforcement_weight() {
    const rebarKgM2 = this.std('rebarKgM2', 15);
    const d = this.calculate_derived_dimensions();
    const weightKg = this.round(d.surface_area_m2 * rebarKgM2);
    this.audit('dome_shell_reinforcement',
      `A=${d.surface_area_m2}m² × ${rebarKgM2}kg/m²`,
      weightKg,
      `W = ${d.surface_area_m2} × ${rebarKgM2} = ${weightKg}kg (thin shell ratio)`);
    return weightKg;
  }

  calculate_finishes() {
    const d = this.calculate_derived_dimensions();
    const exposed = d.surface_area_m2;
    return {
      plaster_area_m2: this.round(exposed),
      paint_area_m2: this.round(exposed * 2),
      screed_volume_m3: 0,
      tiling_area_m2: 0,
      skirting_length_m: 0
    };
  }

  calculate(ctx) {
    return super.calculate(ctx);
  }
}

module.exports = DomeShellRule;
