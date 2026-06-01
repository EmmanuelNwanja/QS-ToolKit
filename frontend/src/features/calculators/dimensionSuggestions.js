const MODULAR_SIZES = [150, 200, 225, 250, 300, 375, 450];
const SLAB_THICKNESSES = [100, 120, 125, 150, 175, 200, 250];

function modularRound(value, sizes) {
  if (!sizes || sizes.length === 0) return Math.round(value / 25) * 25;
  let closest = sizes[0];
  for (const s of sizes) {
    if (Math.abs(s - value) < Math.abs(closest - value)) closest = s;
  }
  return closest;
}

function parseNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/* ── Formwork ───────────────────────────────────────────── */
export function suggestFormwork(form) {
  const beams = (form.beams || []).map((b, i) => {
    const len = parseNum(b.length_mm);
    if (len) {
      const depth = modularRound(len / 12, MODULAR_SIZES);
      const width = modularRound(depth / 2.5, MODULAR_SIZES);
      return { index: i, width, depth, source: `L/12 → depth ${depth}mm, width ${width}mm` };
    }
    return null;
  }).filter(Boolean);

  const slabs = (form.slabs || []).map((s, i) => {
    const len = parseNum(s.length_mm);
    const w = parseNum(s.width_mm);
    if (len && w) {
      const soffitArea = (len * w) / 1e6;
      const typicalBeamWidth = 225;
      return { index: i, soffitAreaM2: Math.round(soffitArea * 100) / 100, suggestedBeamWidth: typicalBeamWidth, source: `${(len/1000).toFixed(2)}×${(w/1000).toFixed(2)}m → ${(soffitArea).toFixed(2)}m² soffit` };
    }
    if (len && !w) {
      return { index: i, message: 'Enter width to compute soffit area' };
    }
    return null;
  }).filter(Boolean);

  const columns = (form.columns || []).map((c, i) => {
    const ht = parseNum(c.height_mm);
    if (ht) {
      const size = modularRound(ht / 12, MODULAR_SIZES);
      return { index: i, width: size, depth: size, source: `H/12 → ${size}mm` };
    }
    return null;
  }).filter(Boolean);

  const lintels = (form.lintels || []).map((l, i) => {
    const len = parseNum(l.length_mm);
    if (len) {
      const depth = modularRound(len / 12, MODULAR_SIZES);
      const width = modularRound(depth / 2.5, MODULAR_SIZES);
      return { index: i, width, depth, source: `L/12 → depth ${depth}mm, width ${width}mm` };
    }
    return null;
  }).filter(Boolean);

  const staircase = [];
  if (form.stairEnabled && form.stair) {
    const st = form.stair;
    const risers = parseNum(st.no_risers);
    const riserH = parseNum(st.riser_h_mm);
    const treadD = parseNum(st.tread_d_mm);
    if (risers && riserH && treadD) {
      const going = risers * treadD / 1000;
      const rise = risers * riserH / 1000;
      const waist = Math.round(Math.sqrt(going * going + rise * rise) * 100) / 100;
      staircase.push({ waistLengthM: waist, source: `${risers} risers × ${riserH}mm rise + ${treadD}mm tread → ${waist}m waist` });
    }
  }

  return { beams, slabs, columns, lintels, staircase };
}

/* ── Concrete ────────────────────────────────────────────── */
export function suggestConcrete(form) {
  return (form.elements || []).map((el, i) => {
    const len = parseNum(el.length);
    const w = parseNum(el.width);
    const h = parseNum(el.height);
    const result = { index: i, type: el.type, sources: [] };

    if (el.type === 'slab' && len && !parseNum(el.thickness)) {
      const thk = modularRound((len * 1000) / 30, SLAB_THICKNESSES) / 1000;
      result.suggestedThickness = thk;
      result.sources.push(`L/30 → ${thk}m thick`);
    }
    if (el.type === 'beam' && len && !parseNum(el.depth)) {
      const depth = modularRound(len * 1000 / 12, MODULAR_SIZES) / 1000;
      result.suggestedDepth = depth;
      result.sources.push(`L/12 → ${depth}m deep`);
    }
    if (el.type === 'column' && h && !parseNum(el.width)) {
      const size = modularRound(h * 1000 / 12, MODULAR_SIZES) / 1000;
      result.suggestedWidth = size;
      result.sources.push(`H/12 → ${size}m wide`);
    }
    if (el.type === 'footing' && len && w && !parseNum(el.depth)) {
      const depth = modularRound(Math.min(len, w) * 1000 / 2, SLAB_THICKNESSES) / 1000;
      result.suggestedDepth = depth;
      result.sources.push(`min(L,W)/2 → ${depth}m deep`);
    }
    if (len && w) {
      const vol = len * w * (parseNum(el.thickness) || parseNum(el.depth) || 0.15);
      result.volumeEstimate = Math.round(vol * 100) / 100;
    }
    return result;
  });
}

/* ── Steel ───────────────────────────────────────────────── */
export function suggestSteel(form) {
  return (form.bars || []).map((bar, i) => {
    const d = parseNum(bar.diameter_mm);
    const len = parseNum(bar.length_m);
    const qty = parseNum(bar.quantity);
    if (d && len) {
      const perBar = (d * d / 162) * len;
      const total = perBar * (qty || 1);
      return { index: i, weightPerBar: Math.round(perBar * 100) / 100, totalKg: Math.round(total * 100) / 100, source: `${d}mmϕ × ${len}m → ${perBar.toFixed(2)} kg/bar` };
    }
    return { index: i, message: 'Enter diameter and length to estimate weight' };
  });
}

/* ── Masonry ─────────────────────────────────────────────── */
export function suggestMasonry(form) {
  return (form.walls || []).map((wall, i) => {
    const len = parseNum(wall.length);
    const ht = parseNum(wall.height);
    if (len && ht) {
      const area = len * ht;
      const openings = (wall.openings || []).reduce((sum, o) => sum + parseNum(o.width) * parseNum(o.height), 0);
      const netArea = area - openings;
      const blocksPerM2 = form.block_size === '9inch' ? 10 : form.block_size === '6inch' ? 12 : 14;
      const mortarM3 = netArea * 0.025;
      return { index: i, grossArea: Math.round(area * 100) / 100, netArea: Math.round(netArea * 100) / 100, blocksPerM2, estimatedBlocks: Math.ceil(netArea * blocksPerM2), mortarM3: Math.round(mortarM3 * 100) / 100, source: `${blocksPerM2} blocks/m² → ~${Math.ceil(netArea * blocksPerM2)} blocks, ${mortarM3.toFixed(2)}m³ mortar` };
    }
    return { index: i, message: 'Enter length and height' };
  });
}

/* ── Plastering ──────────────────────────────────────────── */
export function suggestPlastering(form) {
  return (form.surfaces || []).map((s, i) => {
    const len = parseNum(s.length);
    const ht = parseNum(s.height);
    if (len && ht) {
      const gross = len * ht;
      const openings = (s.openings || []).reduce((sum, o) => sum + parseNum(o.width) * parseNum(o.height), 0);
      const net = gross - openings;
      const thick = (parseNum(form.thickness_mm) || 15) / 1000;
      const mortarVol = net * thick * 1.3;
      return { index: i, grossArea: Math.round(gross * 100) / 100, netArea: Math.round(net * 100) / 100, mortarVol: Math.round(mortarVol * 100) / 100, source: `${net.toFixed(2)}m² net × ${thick*1000}mm → ~${mortarVol.toFixed(2)}m³ mortar` };
    }
    return { index: i, message: 'Enter length and height' };
  });
}

/* ── Paint ───────────────────────────────────────────────── */
export function suggestPaint(form) {
  return (form.surfaces || []).map((s, i) => {
    const len = parseNum(s.length);
    const ht = parseNum(s.height);
    if (len && ht) {
      const gross = len * ht;
      const openings = (s.openings || []).reduce((sum, o) => sum + parseNum(o.width) * parseNum(o.height), 0);
      const net = gross - openings;
      const coverage = parseNum(form.coverage_m2_per_litre) || 10;
      const coats = parseInt(form.coats) || 2;
      const litres = net * coats / coverage;
      return { index: i, netArea: Math.round(net * 100) / 100, estimatedLitres: Math.round(litres * 100) / 100, source: `${coats} coat${coats > 1 ? 's' : ''} × ${net.toFixed(2)}m² ÷ ${coverage} → ${litres.toFixed(2)}L` };
    }
    return { index: i, message: 'Enter length and height' };
  });
}

/* ── Roofing ─────────────────────────────────────────────── */
export function suggestRoofing(form) {
  const len = parseNum(form.length);
  const w = parseNum(form.width);
  if (len && w) {
    const pitch = parseNum(form.pitch_degrees) || 25;
    const rad = pitch * Math.PI / 180;
    const slopeFactor = 1 / Math.cos(rad);
    const planArea = len * w;
    const roofArea = planArea * slopeFactor;
    const sheetW = parseNum(form.sheet_width_m) || 0.9;
    const sheetL = parseNum(form.sheet_length_m) || 3.6;
    const effW = sheetW - 0.1;
    const rowsPerSide = Math.ceil((roofArea / 2) / (sheetL * effW));
    const cols = form.roof_type === 'flat' ? 1 : Math.ceil((w / 2) / effW) * 2;
    return [{
      slopeFactor: Math.round(slopeFactor * 1000) / 1000,
      planArea: Math.round(planArea * 100) / 100,
      roofArea: Math.round(roofArea * 100) / 100,
      estimatedSheets: rowsPerSide * cols,
      purlinLengthM: Math.round((len + 0.5) * (cols + 1) * 100) / 100,
      source: `${pitch}° pitch, ${(len*1).toFixed(1)}×${(w*1).toFixed(1)}m plan`
    }];
  }
  return [];
}

/* ── Earthwork ───────────────────────────────────────────── */
export function suggestEarthwork(form) {
  return (form.sections || []).map((sec, i) => {
    const len = parseNum(sec.length);
    const w = parseNum(sec.width);
    const d = parseNum(sec.depth);
    if (len && w && d) {
      const ws = (parseNum(form.working_space_mm) || 300) / 1000;
      const wsMode = form.working_space_mode === 'both_sides' ? 2 : 1;
      const effW = w + ws * wsMode;
      const vol = len * effW * d;
      const bkFactors = { loam: 1.25, clay: 1.35, sandy: 1.15, laterite: 1.20 };
      const bf = bkFactors[form.soil_type] || 1.25;
      const backfill = parseNum(form.backfill_factor) || 0.6;
      const disposal = vol * bf - vol * backfill;
      const trucks = Math.ceil(disposal / 6);
      return { index: i, effectiveWidth: Math.round(effW * 100) / 100, inSituVolume: Math.round(vol * 100) / 100, looseVolume: Math.round(vol * bf * 100) / 100, disposalVolume: Math.round(disposal * 100) / 100, estimatedTruckLoads: trucks, source: `${effW.toFixed(2)}m eff. width → ${vol.toFixed(2)}m³ in-situ` };
    }
    return { index: i, message: 'Enter length, width, and depth' };
  });
}

/* ── Tiling ──────────────────────────────────────────────── */
export function suggestTiling(form) {
  return (form.rooms || []).map((r, i) => {
    const len = parseNum(r.length);
    const w = parseNum(r.width);
    if (len && w) {
      const area = len * w;
      const tileL = parseNum(form.tile_length_m) || 0.6;
      const tileW = parseNum(form.tile_width_m) || 0.6;
      const tileArea = tileL * tileW;
      const wastage = (parseNum(form.wastage) || 10) / 100;
      const tiles = Math.ceil(area / tileArea * (1 + wastage));
      const boxes = Math.ceil(tiles / 4);
      return { index: i, area: Math.round(area * 100) / 100, tilesNeeded: tiles, boxesNeeded: boxes, source: `${area.toFixed(2)}m² ÷ ${tileArea.toFixed(2)}m²/tile → ${tiles} tiles @ ${wastage*100}% waste` };
    }
    return { index: i, message: 'Enter length and width' };
  });
}

/* ── Carpentry ───────────────────────────────────────────── */
export function suggestCarpentry(form) {
  const len = parseNum(form.building_length_mm);
  const w = parseNum(form.building_width_mm);
  const pitch = parseNum(form.pitch_degrees) || 25;
  const eaves = parseNum(form.eaves_projection_mm) || 900;
  if (len && w) {
    const rad = pitch * Math.PI / 180;
    const halfSpan = w / 2;
    const slopeLen = (halfSpan + eaves) / Math.cos(rad);
    const roofLen = len + 2 * eaves;
    const rafterCount = Math.ceil(roofLen / 600) + 1;
    const wallPlateLen = len + w * 2;
    const purlinCount = Math.ceil(slopeLen / 1200) + 1;
    return [{
      rafterLengthMm: Math.round(slopeLen),
      rafterCount,
      wallPlateLengthMm: Math.round(wallPlateLen * 2),
      purlinLengthM: Math.round((len + 2 * eaves) * purlinCount / 1000 * 100) / 100,
      source: `${pitch}° pitch, span ${(w/1000).toFixed(2)}m → rafter ~${Math.round(slopeLen/1000).toFixed(2)}m`
    }];
  }
  return [];
}

/* ── Roof Accessories ────────────────────────────────────── */
export function suggestRoofAccessories(form) {
  const len = parseNum(form.building_length_mm);
  const w = parseNum(form.building_width_mm);
  const eaves = parseNum(form.eaves_projection_mm) || 900;
  if (len && w) {
    const ridgeLen = len;
    const totalRidgeLen = len + 2 * eaves;
    const fasciaLen = form.roof_type === 'hipped' ? (len + w) * 2 : 2 * (len + 2 * eaves) + w;
    const bargeLen = form.roof_type === 'gabled' ? 2 * (w / 2 + eaves) : 0;
    const straps = Math.ceil(totalRidgeLen / (parseNum(form.metal_strap_spacing_mm) || 1200));
    return [{
      ridgeLengthMm: Math.round(ridgeLen),
      fasciaLengthMm: Math.round(fasciaLen),
      bargeLengthMm: Math.round(bargeLen),
      estimatedStraps: straps,
      source: `Ridge ${(ridgeLen/1000).toFixed(2)}m, fascia ${(fasciaLen/1000).toFixed(2)}m, ${straps} straps`
    }];
  }
  return [];
}

/* ── Door / Window ───────────────────────────────────────── */
export function suggestDoorWindow(form) {
  const doors = (form.doors || []).map(d => {
    const w = parseNum(d.width_mm);
    const h = parseNum(d.height_mm);
    const qty = parseInt(d.quantity) || 1;
    if (w && h) {
      const unitArea = w * h / 1e6;
      const frameLen = (w + h) * 2 / 1000;
      return { ...d, unitAreaM2: Math.round(unitArea * 100) / 100, totalAreaM2: Math.round(unitArea * qty * 100) / 100, frameLengthM: Math.round(frameLen * qty * 100) / 100 };
    }
    return d;
  });
  const windows = (form.windows || []).map(win => {
    const w = parseNum(win.width_mm);
    const h = parseNum(win.height_mm);
    const qty = parseInt(win.quantity) || 1;
    if (w && h) {
      const unitArea = w * h / 1e6;
      const frameLen = (w + h) * 2 / 1000;
      return { ...win, unitAreaM2: Math.round(unitArea * 100) / 100, totalAreaM2: Math.round(unitArea * qty * 100) / 100, frameLengthM: Math.round(frameLen * qty * 100) / 100 };
    }
    return win;
  });
  const burglaryProof = (form.burglary_proof || []).map(bp => {
    const w = parseNum(bp.width_mm);
    const h = parseNum(bp.height_mm);
    const qty = parseInt(bp.quantity) || 1;
    if (w && h) {
      const area = w * h / 1e6;
      return { ...bp, unitAreaM2: Math.round(area * 100) / 100, totalAreaM2: Math.round(area * qty * 100) / 100 };
    }
    return bp;
  });
  return { doors, windows, burglaryProof };
}

/* ── BRC / DPM ───────────────────────────────────────────── */
export function suggestBrcDpm(form) {
  const areas = (form.floor_areas || []).map((a, i) => {
    const len = parseNum(a.length_mm);
    const w = parseNum(a.width_mm);
    if (len && w) {
      const areaM2 = len * w / 1e6;
      const meshW = 2.4;
      const meshL = 4.8;
      const sideLap = (parseNum(form.brc_side_lap_mm) || 100) / 1000;
      const endLap = (parseNum(form.brc_end_lap_mm) || 200) / 1000;
      const effSheetW = meshW - sideLap;
      const effSheetL = meshL - endLap;
      const sheetsPerRow = Math.ceil((len / 1000) / effSheetW);
      const rows = Math.ceil((w / 1000) / effSheetL);
      const meshSheets = sheetsPerRow * rows;
      return { index: i, areaM2: Math.round(areaM2 * 100) / 100, estimatedMeshSheets: meshSheets, source: `${areaM2.toFixed(2)}m² → ~${meshSheets} BRC sheets` };
    }
    return { index: i, message: 'Enter length and width' };
  });

  const totalArea = areas.reduce((s, a) => s + (a.areaM2 || 0), 0);
  let dpm = null;
  if (totalArea && form.include_dpm) {
    const lap = (parseNum(form.dpm_laps_mm) || 150) / 1000;
    const rollW = 4;
    const rollL = 25;
    const effRollW = rollW - lap;
    const dpmRolls = Math.ceil(totalArea / (effRollW * rollL));
    dpm = { totalAreaM2: Math.round(totalArea * 100) / 100, estimatedRolls: dpmRolls };
  }

  return { areas, dpm, totalAreaM2: Math.round(totalArea * 100) / 100 };
}

export function getAllSuggestions(calculatorId, form) {
  const map = {
    formwork: suggestFormwork,
    concrete: suggestConcrete,
    steel: suggestSteel,
    masonry: suggestMasonry,
    plastering: suggestPlastering,
    paint: suggestPaint,
    roofing: suggestRoofing,
    earthwork: suggestEarthwork,
    tiling: suggestTiling,
    carpentry: suggestCarpentry,
    'roof-accessories': suggestRoofAccessories,
    'door-window': suggestDoorWindow,
    'brc-dpm': suggestBrcDpm
  };
  const fn = map[calculatorId];
  return fn ? fn(form) : [];
}
