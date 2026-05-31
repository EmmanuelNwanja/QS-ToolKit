/**
 * FormworkIntelligence
 *
 * Auto-detects beam formwork type (isolated / slab-adjacent / wall-adjacent),
 * calculates props, ties, and plywood sheet optimisation.
 *
 * Input element shapes:
 *   Beam:   { type:'beam', length_m, depth_m, width_m, adjacent_to, beam_type }
 *   Slab:   { type:'slab', length_m, width_m, thickness_m, plan_area }
 *   Column: { type:'column', height_m, width_m, depth_m }
 *   Wall:   { type:'wall', length_m, height_m, thickness_m }
 */

const SHEET_WIDTH_M  = 1.220;
const SHEET_HEIGHT_M = 2.440;
const SHEET_AREA_M2  = SHEET_WIDTH_M * SHEET_HEIGHT_M;  // 2.9768 m²

class FormworkIntelligence {
  constructor(config = {}) {
    this.defaultPropSpacingSlabM = config.propSpacingSlabM || 1.0;
    this.defaultPropSpacingBeamM = config.propSpacingBeamM || 0.8;
    this.defaultTieSpacingM = config.tieSpacingM || 0.6;
    this.plywoodReuseCycles = config.plywoodReuseCycles || 8;
    this.plywoodWasteFactor = config.plywoodWasteFactor || 1.10;
    this.sheetWidthM = config.sheetWidthM || SHEET_WIDTH_M;
    this.sheetHeightM = config.sheetHeightM || SHEET_HEIGHT_M;
  }

  /** ── 1. Beam Formwork Type Detection ─────────────────────── */
  beamFormworkType(beam) {
    const adj = beam.adjacent_to || '';
    if (beam.beam_type === 'isolated') return 'isolated';
    if (beam.beam_type === 'lateral') return 'slab-adjacent';
    if (adj.includes('wall') || adj === 'wall') return 'wall-adjacent';

    // Heuristic: if depth is significantly more than slab thickness, treat as isolated
    if (beam.slab_thickness_m !== undefined && beam.depth_m > beam.slab_thickness_m + 0.15) {
      return 'isolated';
    }
    if (beam.slab_thickness_m !== undefined && beam.depth_m <= beam.slab_thickness_m + 0.15) {
      return 'slab-adjacent';
    }
    return 'slab-adjacent'; // default safe assumption
  }

  /** ── 2a. Formwork Area by Type ─────────────────────────── */
  beamFormworkArea(beam) {
    const { length_m: L, depth_m: D, width_m: W } = beam;
    const type = this.beamFormworkType(beam);

    if (type === 'isolated') {
      // 2 sides + soffit + 2 ends
      const sides = 2 * L * D;
      const soffit = W * L;
      const ends = 2 * W * D;
      return { type, sides_m2: sides, soffit_m2: soffit, ends_m2: ends, total_m2: sides + soffit + ends };
    }

    if (type === 'slab-adjacent') {
      // 2 sides + soffit (top against slab, no ends in some conventions)
      const sides = 2 * L * D;
      const soffit = W * L;
      return { type, sides_m2: sides, soffit_m2: soffit, total_m2: sides + soffit };
    }

    if (type === 'wall-adjacent') {
      // 1 exposed side + soffit + opposite side
      const side = L * D;          // one vertical face
      const soffit = W * L;
      const oppSide = L * D;       // opposite face
      return { type, exposed_side_m2: side, soffit_m2: soffit, opposite_side_m2: oppSide, total_m2: side + soffit + oppSide };
    }

    return { type, total_m2: 2 * L * D + W * L };
  }

  /** ── 2b. Slab Prop Calculation ──────────────────────────── */
  slabProps(slab) {
    const area = slab.plan_area || (slab.length_m * slab.width_m);
    const spacing = slab.prop_spacing_m || this.defaultPropSpacingSlabM;
    const count = Math.ceil(area / (spacing * spacing));
    return { count, spacing_m: spacing, area_m2: area, grid: `${spacing}×${spacing}m` };
  }

  /** ── 2c. Beam Prop Calculation ──────────────────────────── */
  beamProps(beam) {
    const L = beam.length_m || 0;
    const spacing = beam.prop_spacing_m || this.defaultPropSpacingBeamM;
    const count = Math.floor(L / spacing) + 1;
    return { count, spacing_m: spacing, length_m: L };
  }

  /** ── 2d. Wall/Column Tie Calculation ────────────────────── */
  ties(element) {
    const H = element.height_m || 0;
    const L = element.length_m || element.width_m || 0;
    const spacing = element.tie_spacing_m || this.defaultTieSpacingM;
    const rows = Math.ceil(H / spacing);
    const cols = Math.ceil(L / spacing);
    const count = rows * cols;
    return { count, rows, cols, spacing_m: spacing };
  }

  /** ── 3. Plywood / Panel Optimization ───────────────────── */
  plywoodOptimization(totalFormworkM2) {
    const gross = totalFormworkM2 * this.plywoodWasteFactor;
    const sheetsPerUse = Math.ceil(gross / this.sheetArea());
    const sheetsPerReplace = Math.ceil(gross / (this.sheetArea() * this.plywoodReuseCycles));
    return {
      total_formwork_m2: this._r(totalFormworkM2),
      gross_with_waste_m2: this._r(gross),
      sheet_area_m2: this._r(this.sheetArea()),
      sheets_required_per_use: sheetsPerUse,
      sheets_per_replacement_cycle: Math.max(1, Math.ceil(sheetsPerUse / this.plywoodReuseCycles)),
      reuse_cycles: this.plywoodReuseCycles,
      waste_factor: this.plywoodWasteFactor,
      note: `${sheetsPerUse} sheets needed per use (reused ${this.plywoodReuseCycles}x before replacement; order ${Math.max(1, Math.ceil(sheetsPerUse / this.plywoodReuseCycles))} sheets per cycle if sequenced)`
    };
  }

  sheetArea() { return this.sheetWidthM * this.sheetHeightM; }

  _r(v) { return +v.toFixed(4); }
}

module.exports = FormworkIntelligence;
