const BaseElementRule = require('../BaseElementRule');

class RectangularColumnRule extends BaseElementRule {
  constructor() { super('column'); }

  calculate_derived_dimensions() {
    const heightMm = this.ctx.primaryDimMm;
    const heightRatio = this.std('heightRatio', { min: 10, max: 15 });
    const minSize = this.std('minSizeMm', 230);
    const modularSizes = this.std('modularSizes', [200, 225, 250, 300, 350, 400, 450, 500, 600]);
    const slabDropMm = this.ctx.extra.slab_thickness_mm || 150;
    let clearHeightMm = heightMm - slabDropMm;

    const avgRatio = (heightRatio.min + heightRatio.max) / 2;
    let sizeMm = Math.max(Math.round(clearHeightMm / avgRatio), minSize);
    sizeMm = this.modularRound(sizeMm, modularSizes);

    this.audit('column_size_from_height',
      `${clearHeightMm}mm clear height / ${avgRatio}`,
      sizeMm,
      `b = max((${heightMm} - ${slabDropMm})/${avgRatio}, ${minSize}) = ${sizeMm}mm`);

    sizeMm = this.resolveOverride('width_mm', sizeMm);

    const columnShape = this.ctx.columnShape || 'square';
    let widthMm = sizeMm;
    let depthMm = sizeMm;
    if (columnShape === 'rectangular') {
      depthMm = Math.round(sizeMm * 1.5);
      depthMm = this.resolveOverride('depth_mm', depthMm);
    }

    const columnHeightM = this.round(clearHeightMm / 1000);
    const widthM = this.mmToM(widthMm);
    const depthM = this.mmToM(depthMm);
    const coverMm = this.std('coverMm', 30);

    return {
      width_mm: widthMm,
      depth_mm: depthMm,
      height_m: columnHeightM,
      cover_mm: coverMm,
      clear_height_m: this.round(clearHeightMm / 1000),
      height_to_min_size_ratio: this.round(clearHeightMm / Math.min(widthMm, depthMm), 2)
    };
  }

  calculate_volume() {
    const d = this.calculate_derived_dimensions();
    const qty = this.ctx.quantity;
    return this.m3(this.mmToM(d.width_mm) * this.mmToM(d.depth_mm) * d.height_m * qty);
  }

  calculate_formwork_area() {
    const d = this.calculate_derived_dimensions();
    const widthM = this.mmToM(d.width_mm);
    const depthM = this.mmToM(d.depth_mm);
    const heightM = d.height_m;
    const qty = this.ctx.quantity;
    const perimeterM = 2 * (widthM + depthM);
    const area = this.m2(perimeterM * heightM * qty);
    return {
      vertical_faces_m2: area,
      perimeter_m: this.round(perimeterM),
      total_m2: area,
      note: 'All vertical faces formed. Top and bottom masked — slab above, footing below.'
    };
  }

  calculate_reinforcement_weight() {
    const vol = this.calculate_volume();
    const kgPerM3 = this.std('rebarKgM3', 150);
    return this.round(vol * kgPerM3);
  }

  calculate_finishes() {
    const fw = this.calculate_formwork_area();
    const exposed = fw.total_m2;
    return {
      plaster_area_m2: this.round(exposed),
      paint_area_m2: this.round(exposed),
      screed_volume_m3: 0,
      tiling_area_m2: this.round(exposed * 1.05),
      skirting_length_m: 0
    };
  }
}

module.exports = RectangularColumnRule;
