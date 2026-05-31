/**
 * FinishCascadeCalculator
 *
 * Derives finishes takeoff quantities from a StructuralElement.
 * Used standalone or as a replacement for the per-rule calculate_finishes() methods.
 *
 * A StructuralElement is:
 *   { type, length_m, width_m, depth_m, height_m, thickness_m,
 *     flush_with_ceiling, wall_adjacent, openings, plan_area,
 *     beam_type, column_shape, column_count }
 */

const TILE_SIZES = { '300×300': 0.09, '400×400': 0.16, '600×600': 0.36 };
const DEFAULT_TILE_KEY = '400×400';

class FinishCascadeCalculator {
  constructor(config = {}) {
    this.screedDefaultThicknessM = config.screedThicknessM || 0.040;
    this.paintCoverageM2PerL = config.paintCoverageM2PerL || 12;
    this.skirtingDefaultHeightM = config.skirtingHeightM || 0.100;
    this.defaultTileKey = config.defaultTileKey || DEFAULT_TILE_KEY;
    this.wasteFactor = config.wasteFactor || 1.05;
  }

  /**
   * @param {Object} el — StructuralElement
   * @returns {Object} FinishesTakeoff
   */
  calculate(el) {
    if (!el || !el.type) throw new Error('StructuralElement requires a type');

    const plaster = this._plaster(el);
    const paint = this._paint(plaster.netArea);
    const screed = this._screed(el);
    const tiling = this._tiling(el, screed.planArea);
    const skirting = this._skirting(el);
    const ceiling = this._ceiling(el);

    return {
      plaster_area_m2: this._r(plaster.netArea),
      plaster_breakdown: plaster.breakdown,
      paint_area_m2: this._r(paint.area),
      paint_litres: this._r(paint.litres),
      paint_breakdown: paint.breakdown,
      screed_volume_m3: this._r(screed.volume),
      screed_thickness_m: screed.thickness,
      screed_net_plan_area_m2: this._r(screed.planArea),
      tiling_area_m2: this._r(tiling.area),
      tile_count: tiling.count,
      tile_size: tiling.tileKey,
      tiling_waste_factor: this.wasteFactor,
      skirting_length_m: this._r(skirting.length),
      skirting_height_m: this.skirtingDefaultHeightM,
      skirting_area_m2: this._r(skirting.length * this.skirtingDefaultHeightM),
      ceiling_finish_area_m2: this._r(ceiling.area),
      ceiling_breakdown: ceiling.breakdown,
      notes: this._collectNotes(plaster, screed, tiling, skirting, ceiling)
    };
  }

  // ── Plaster / Render ──────────────────────────────────────────
  _plaster(el) {
    const bd = {};
    switch (el.type) {
      case 'beam': {
        const { length_m: L, depth_m: D, width_m: W, flush_with_ceiling } = el;
        const sides = 2 * L * D;
        let soffit = W * L;
        if (flush_with_ceiling) soffit = 0;
        const top = 0;
        bd.sides_m2 = this._r(sides);
        bd.soffit_m2 = this._r(soffit);
        bd.top_m2 = 0;
        return { netArea: sides + soffit, breakdown: bd };
      }
      case 'column': {
        const { height_m: H, width_m: W, depth_m: D, wall_adjacent } = el;
        const perimeter = 2 * (W + D);
        const wallAdjFace = wall_adjacent ? 0 : (wall_adjacent === false ? 0 : null);
        let exposedFaces = 4;
        if (wall_adjacent === true) exposedFaces = 2;
        else if (wall_adjacent === 'one_side') exposedFaces = 3;
        const area = H * (W + D) * (exposedFaces / 2);
        bd.faces = exposedFaces;
        bd.area_perimeter_based = this._r(area);
        return { netArea: area, breakdown: bd };
      }
      case 'slab': {
        // Soffit area only (underside)
        const soffit = el.plan_area || (el.length_m * el.width_m);
        bd.soffit_m2 = this._r(soffit);
        return { netArea: soffit, breakdown: bd };
      }
      default:
        return { netArea: 0, breakdown: { note: `No plaster rule for ${el.type}` } };
    }
  }

  // ── Paint ─────────────────────────────────────────────────────
  _paint(plasterArea) {
    return {
      area: plasterArea,
      litres: plasterArea / this.paintCoverageM2PerL,
      breakdown: { plaster_area_m2: plasterArea, coverage_m2_per_l: this.paintCoverageM2PerL }
    };
  }

  // ── Floor Screed ──────────────────────────────────────────────
  _screed(el) {
    if (el.type !== 'slab') return { volume: 0, thickness: 0, planArea: 0 };
    const grossArea = el.plan_area || (el.length_m * el.width_m);
    const deductions = this._columnFootprintDeductions(el);
    const netArea = Math.max(0, grossArea - deductions);
    return {
      volume: netArea * this.screedDefaultThicknessM,
      thickness: this.screedDefaultThicknessM,
      planArea: netArea,
      deducted_m2: this._r(deductions)
    };
  }

  _columnFootprintDeductions(el) {
    const cols = el.columns || [];
    if (!cols.length) return 0;
    return cols
      .filter(c => (c.width_m || 0) * (c.depth_m || 0) > 0.1)
      .reduce((sum, c) => sum + (c.width_m || 0) * (c.depth_m || 0), 0);
  }

  // ── Tiling ─────────────────────────────────────────────────────
  _tiling(el, planArea) {
    if (el.type !== 'slab') return { area: 0, count: 0, tileKey: this.defaultTileKey };
    const areaWithWaste = planArea * this.wasteFactor;
    const tileKey = el.tile_size || this.defaultTileKey;
    const tileArea = TILE_SIZES[tileKey] || TILE_SIZES[DEFAULT_TILE_KEY];
    const count = Math.ceil(areaWithWaste / tileArea);
    return { area: this._r(areaWithWaste), count, tileKey };
  }

  // ── Skirting ──────────────────────────────────────────────────
  _skirting(el) {
    if (el.type !== 'slab') return { length: 0 };
    const perimeter = 2 * ((el.length_m || 0) + (el.width_m || 0));
    const doorDeductions = (el.openings || []).filter(o => o.type === 'door').reduce((s, o) => s + (o.width_m || 0), 0);
    return { length: Math.max(0, perimeter - doorDeductions) };
  }

  // ── Ceiling finish ────────────────────────────────────────────
  _ceiling(el) {
    if (el.type !== 'slab') return { area: 0, breakdown: {} };
    const soffit = el.plan_area || (el.length_m * el.width_m);
    const beamSoffitStrips = (el.beams_below || []).reduce((s, b) => s + (b.width_m || 0) * (b.length_m || 0), 0);
    return {
      area: soffit + beamSoffitStrips,
      breakdown: { slab_soffit_m2: this._r(soffit), beam_soffit_strips_m2: this._r(beamSoffitStrips) }
    };
  }

  // ── Notes ──────────────────────────────────────────────────────
  _collectNotes(plaster, screed, tiling, skirting, ceiling) {
    const notes = [];
    if (plaster.breakdown?.faces !== undefined && plaster.breakdown.faces < 4) {
      notes.push(`Column has ${plaster.breakdown.faces} exposed faces (wall-adjacent deduction applied)`);
    }
    if (screed.deducted_m2 > 0) {
      notes.push(`Screed plan area deducts ${screed.deducted_m2} m² for column footprints > 0.1 m²`);
    }
    if (tiling.count > 0) {
      notes.push(`Tiling: ${tiling.count} tiles (${tiling.tileKey}), includes ${((this.wasteFactor - 1) * 100).toFixed(0)}% waste`);
    }
    if (skirting.length > 0) {
      notes.push(`Skirting: ${this._r(skirting.length)}m (perimeter minus door openings)`);
    }
    if (ceiling.breakdown?.beam_soffit_strips_m2 > 0) {
      notes.push(`Ceiling includes ${ceiling.breakdown.beam_soffit_strips_m2} m² of beam soffit strips below slab`);
    }
    return notes;
  }

  _r(v) { return +v.toFixed(4); }
}

module.exports = FinishCascadeCalculator;
