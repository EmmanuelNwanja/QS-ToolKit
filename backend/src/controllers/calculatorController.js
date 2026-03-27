const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');

// ================================================================
//  All QS Calculators — Nigerian construction standards
// ================================================================

// ── Concrete Volume ────────────────────────────────────────────
exports.concrete = async (req, res, next) => {
  try {
    const { elements = [], mix_ratio = '1:2:4', wastage_percent = 5 } = req.body;
    const results = [];
    let totalVolume = 0;

    // Cement-Sand-Aggregate ratios by mix
    const mixRatios = {
      '1:1:2':  { cement: 1, sand: 1, aggregate: 2, total: 4 },
      '1:1.5:3':{ cement: 1, sand: 1.5, aggregate: 3, total: 5.5 },
      '1:2:4':  { cement: 1, sand: 2, aggregate: 4, total: 7 },
      '1:3:6':  { cement: 1, sand: 3, aggregate: 6, total: 10 }
    };
    const ratio = mixRatios[mix_ratio] || mixRatios['1:2:4'];

    elements.forEach(el => {
      let vol = 0;
      if (el.type === 'slab')         vol = el.length * el.width * el.thickness;
      else if (el.type === 'column')  vol = el.width * el.depth * el.height * (el.count || 1);
      else if (el.type === 'beam')    vol = el.width * el.depth * el.length * (el.count || 1);
      else if (el.type === 'footing') vol = el.length * el.width * el.depth * (el.count || 1);

      totalVolume += vol;
      results.push({ ...el, volume_m3: +vol.toFixed(4) });
    });

    const withWastage = totalVolume * (1 + wastage_percent / 100);
    // Dry volume factor ≈ 1.54 for wet to dry conversion
    const dryVolume = withWastage * 1.54;

    const cementParts = ratio.cement / ratio.total;
    const sandParts = ratio.sand / ratio.total;
    const aggParts = ratio.aggregate / ratio.total;

    // 1 bag of cement = 0.035 m³
    const cementBags = Math.ceil((dryVolume * cementParts) / 0.035);
    const sandM3     = +(dryVolume * sandParts).toFixed(3);
    const aggM3      = +(dryVolume * aggParts).toFixed(3);

    await logUsage(req.user.id, 'concrete');

    return res.json(success('Concrete calculation complete', {
      elements: results,
      summary: {
        net_volume_m3: +totalVolume.toFixed(4),
        with_wastage_m3: +withWastage.toFixed(4),
        dry_volume_m3: +dryVolume.toFixed(4),
        mix_ratio,
        wastage_percent,
        materials: {
          cement_bags_50kg: cementBags,
          sharp_sand_m3: sandM3,
          granite_aggregate_m3: aggM3
        }
      }
    }));
  } catch (err) { next(err); }
};

// ── Masonry / Blockwork ────────────────────────────────────────
exports.masonry = async (req, res, next) => {
  try {
    const {
      walls = [],
      block_size = '9inch',    // '9inch' | '6inch' | '5inch'
      mortar_ratio = '1:6',
      include_mortar = true,
      wastage_percent = 5
    } = req.body;

    // Nigerian standard block dimensions (L x H in mm)
    const blockDimensions = {
      '9inch':  { length: 450, height: 225, thickness: 225, face_area: 0.101 },  // m²
      '6inch':  { length: 450, height: 225, thickness: 150, face_area: 0.101 },
      '5inch':  { length: 450, height: 225, thickness: 125, face_area: 0.101 }
    };
    const block = blockDimensions[block_size] || blockDimensions['9inch'];

    // With 10mm mortar joint, ~10 blocks per m² for standard block
    const blocksPerM2 = 1 / (block.face_area * 1.05); // 5% for joints

    let totalArea = 0;
    const wallResults = walls.map(w => {
      const grossArea = w.length * w.height;
      const deductions = (w.openings || []).reduce((s, o) => s + o.width * o.height, 0);
      const netArea = Math.max(grossArea - deductions, 0);
      totalArea += netArea;
      return { ...w, gross_area_m2: +grossArea.toFixed(3), deductions_m2: +deductions.toFixed(3), net_area_m2: +netArea.toFixed(3) };
    });

    const blocksNeeded = Math.ceil(totalArea * blocksPerM2 * (1 + wastage_percent / 100));

    // Mortar calculation (0.03 m³ per m²)
    const mortarVolumeM3 = +(totalArea * 0.03).toFixed(3);
    const mortarParts = mortar_ratio === '1:4' ? { c: 1, s: 4, t: 5 } : { c: 1, s: 6, t: 7 };
    const cementBags = Math.ceil((mortarVolumeM3 * 1.33 * (mortarParts.c / mortarParts.t)) / 0.035);
    const sandM3 = +(mortarVolumeM3 * 1.33 * (mortarParts.s / mortarParts.t)).toFixed(3);

    await logUsage(req.user.id, 'masonry');

    return res.json(success('Masonry calculation complete', {
      walls: wallResults,
      summary: {
        total_wall_area_m2: +totalArea.toFixed(3),
        block_size,
        blocks_needed: blocksNeeded,
        wastage_included_percent: wastage_percent,
        mortar: include_mortar ? {
          mortar_ratio,
          cement_bags_50kg: cementBags,
          sharp_sand_m3: sandM3
        } : null
      }
    }));
  } catch (err) { next(err); }
};

// ── Plastering / Rendering ─────────────────────────────────────
exports.plastering = async (req, res, next) => {
  try {
    const {
      surfaces = [],
      thickness_mm = 15,
      mortar_ratio = '1:4',   // cement:sand
      wastage_percent = 10
    } = req.body;

    let totalArea = 0;
    const surfaceResults = surfaces.map(s => {
      const area = s.length * s.height;
      totalArea += area;
      return { ...s, area_m2: +area.toFixed(3) };
    });

    const volume = (totalArea * (thickness_mm / 1000)) * (1 + wastage_percent / 100);
    const dryVolume = volume * 1.3;

    const parts = mortar_ratio === '1:3' ? { c: 1, s: 3, t: 4 } : { c: 1, s: 4, t: 5 };
    const cementBags = Math.ceil((dryVolume * parts.c / parts.t) / 0.035);
    const sandM3 = +(dryVolume * parts.s / parts.t).toFixed(3);

    await logUsage(req.user.id, 'plastering');

    return res.json(success('Plastering calculation complete', {
      surfaces: surfaceResults,
      summary: {
        total_surface_area_m2: +totalArea.toFixed(3),
        thickness_mm,
        mortar_ratio,
        wet_volume_m3: +volume.toFixed(4),
        materials: { cement_bags_50kg: cementBags, sharp_sand_m3: sandM3 }
      }
    }));
  } catch (err) { next(err); }
};

// ── Paint ──────────────────────────────────────────────────────
exports.paint = async (req, res, next) => {
  try {
    const {
      surfaces = [],
      coats = 2,
      coverage_m2_per_litre = 10,    // typical Nigerian emulsion
      include_primer = true,
      primer_coverage = 12
    } = req.body;

    let totalArea = 0;
    const surfaceResults = surfaces.map(s => {
      const gross = s.length * s.height;
      const deductions = (s.openings || []).reduce((a, o) => a + o.width * o.height, 0);
      const net = Math.max(gross - deductions, 0);
      totalArea += net;
      return { ...s, area_m2: +net.toFixed(3) };
    });

    const paintLitres = Math.ceil((totalArea * coats) / coverage_m2_per_litre);
    const primerLitres = include_primer ? Math.ceil(totalArea / primer_coverage) : 0;

    // Approx paint tins (5L, 4L, 1L)
    const tins5L = Math.floor(paintLitres / 5);
    const remaining = paintLitres % 5;
    const tins4L = Math.floor(remaining / 4);
    const tins1L = remaining % 4;

    await logUsage(req.user.id, 'paint');

    return res.json(success('Paint calculation complete', {
      surfaces: surfaceResults,
      summary: {
        total_area_m2: +totalArea.toFixed(3),
        coats,
        paint_litres_required: paintLitres,
        suggested_tins: { '5L_tins': tins5L, '4L_tins': tins4L, '1L_tins': tins1L },
        primer_litres: primerLitres
      }
    }));
  } catch (err) { next(err); }
};

// ── Roofing ───────────────────────────────────────────────────
exports.roofing = async (req, res, next) => {
  try {
    const {
      roof_type = 'gable',    // gable | hip | flat
      length, width,
      pitch_degrees = 25,
      sheet_length_m = 3.6,   // standard longspan aluminium in Nigeria
      sheet_width_m = 0.9,    // effective coverage width
      wastage_percent = 10,
      include_accessories = true
    } = req.body;

    const pitchFactor = 1 / Math.cos((pitch_degrees * Math.PI) / 180);
    const planArea = length * width;
    let roofArea;

    if (roof_type === 'gable') roofArea = planArea * pitchFactor;
    else if (roof_type === 'hip') roofArea = planArea * pitchFactor * 1.05;
    else roofArea = planArea; // flat

    const effectiveCoverage = sheet_length_m * sheet_width_m;
    const sheetsNeeded = Math.ceil((roofArea / effectiveCoverage) * (1 + wastage_percent / 100));

    // Purlins: typically at 0.9m spacing
    const purlinSpacing = 0.9;
    const rafterLength = (width / 2) / Math.cos((pitch_degrees * Math.PI) / 180);
    const purlinsPerRafter = Math.ceil(rafterLength / purlinSpacing) + 1;
    const numberOfRafters = Math.ceil(length / 0.9) + 1;
    const totalPurlins = purlinsPerRafter * (roof_type === 'gable' ? 2 : 4);

    await logUsage(req.user.id, 'roofing');

    return res.json(success('Roofing calculation complete', {
      summary: {
        plan_area_m2: +planArea.toFixed(3),
        actual_roof_area_m2: +roofArea.toFixed(3),
        roof_type,
        pitch_degrees,
        sheets: {
          size: `${sheet_length_m}m x ${sheet_width_m}m (Longspan)`,
          quantity_needed: sheetsNeeded
        },
        accessories: include_accessories ? {
          purlins_estimate: totalPurlins,
          ridging_pieces: Math.ceil(length / sheet_length_m) + 1,
          flashings_m: Math.ceil(length * 2)
        } : null
      }
    }));
  } catch (err) { next(err); }
};

// ── Steel / Reinforcement ─────────────────────────────────────
exports.steel = async (req, res, next) => {
  try {
    const { bars = [] } = req.body;

    // Unit weights (kg/m) — BS 4449 standard used in Nigeria
    const unitWeights = {
      6:  0.222, 8:  0.395, 10: 0.617, 12: 0.888,
      16: 1.578, 20: 2.466, 25: 3.854, 32: 6.313
    };

    const results = bars.map(b => {
      const uw = unitWeights[b.diameter_mm] || 0;
      const weightKg = +(b.length_m * b.quantity * uw).toFixed(3);
      const weightTonne = +(weightKg / 1000).toFixed(4);
      return { ...b, unit_weight_kg_per_m: uw, total_weight_kg: weightKg, total_weight_tonne: weightTonne };
    });

    const totalKg = results.reduce((s, r) => s + r.total_weight_kg, 0);

    await logUsage(req.user.id, 'steel');

    return res.json(success('Steel reinforcement calculation complete', {
      bars: results,
      summary: {
        total_weight_kg: +totalKg.toFixed(3),
        total_weight_tonne: +(totalKg / 1000).toFixed(4),
        note: 'Add 5–10% for laps, bends and wastage'
      }
    }));
  } catch (err) { next(err); }
};

// ── Earthwork / Excavation ────────────────────────────────────
exports.earthwork = async (req, res, next) => {
  try {
    const {
      sections = [],
      soil_type = 'loam',     // loam | clay | sandy | laterite
      bulking_factor
    } = req.body;

    const bulkingFactors = { loam: 1.25, clay: 1.35, sandy: 1.15, laterite: 1.20 };
    const bf = bulking_factor || bulkingFactors[soil_type] || 1.25;

    let totalExcavation = 0;
    const sectionResults = sections.map(s => {
      const vol = s.length * s.width * s.depth;
      totalExcavation += vol;
      return { ...s, volume_m3: +vol.toFixed(4) };
    });

    await logUsage(req.user.id, 'earthwork');

    return res.json(success('Earthwork calculation complete', {
      sections: sectionResults,
      summary: {
        total_excavation_m3: +totalExcavation.toFixed(4),
        soil_type,
        bulking_factor: bf,
        loose_volume_m3: +(totalExcavation * bf).toFixed(4),
        truck_loads_5t: Math.ceil((totalExcavation * bf) / 5),
        note: 'Loose volume for haulage truck estimation'
      }
    }));
  } catch (err) { next(err); }
};

// ── Floor Tiling ──────────────────────────────────────────────
exports.tiling = async (req, res, next) => {
  try {
    const {
      rooms = [],
      tile_length_m = 0.6,
      tile_width_m = 0.6,
      wastage_percent = 10,
      grout_bag_covers_m2 = 5
    } = req.body;

    const tileArea = tile_length_m * tile_width_m;

    let totalArea = 0;
    const roomResults = rooms.map(r => {
      const area = r.length * r.width;
      totalArea += area;
      return { ...r, area_m2: +area.toFixed(3) };
    });

    const tilesNeeded = Math.ceil((totalArea / tileArea) * (1 + wastage_percent / 100));
    const groutBags = Math.ceil(totalArea / grout_bag_covers_m2);

    // Boxes (standard: 4 tiles per box for 60x60, adjust as needed)
    const tilesPerBox = tile_length_m === 0.6 ? 4 : tile_length_m === 0.4 ? 6 : 4;
    const boxesNeeded = Math.ceil(tilesNeeded / tilesPerBox);

    await logUsage(req.user.id, 'tiling');

    return res.json(success('Tiling calculation complete', {
      rooms: roomResults,
      summary: {
        total_floor_area_m2: +totalArea.toFixed(3),
        tile_size: `${tile_length_m * 1000}mm x ${tile_width_m * 1000}mm`,
        tiles_needed: tilesNeeded,
        boxes_needed: boxesNeeded,
        tiles_per_box: tilesPerBox,
        grout_bags: groutBags,
        wastage_percent
      }
    }));
  } catch (err) { next(err); }
};

// ── Save calculation ──────────────────────────────────────────
exports.save = async (req, res, next) => {
  try {
    const { calculator_type, title, inputs, outputs, project_id } = req.body;
    const { data } = await supabase
      .from('saved_calculations')
      .insert({ user_id: req.user.id, project_id, calculator_type, title, inputs, outputs })
      .select()
      .single();
    return res.status(201).json(success('Calculation saved', { calculation: data }));
  } catch (err) { next(err); }
};

exports.getSaved = async (req, res, next) => {
  try {
    const { project_id, calculator_type, limit } = req.query;
    let query = supabase.from('saved_calculations').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (project_id) query = query.eq('project_id', project_id);
    if (calculator_type) query = query.eq('calculator_type', calculator_type);
    if (limit && Number(limit) > 0) query = query.limit(Math.min(Number(limit), 100));
    const { data } = await query;
    return res.json(success('Saved calculations', { calculations: data }));
  } catch (err) { next(err); }
};

// ── Helpers ───────────────────────────────────────────────────
async function logUsage(userId, type) {
  await supabase.from('calculator_usage').insert({ user_id: userId, calculator_type: type });
}
