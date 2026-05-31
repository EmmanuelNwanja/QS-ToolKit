const FinishCascadeCalculator = require('../services/FinishCascadeCalculator');

const calc = new FinishCascadeCalculator();

// ── 5m × 0.2m × 0.35m beam ─────────────────────────────────
function testBeamPlasterAndPaint() {
  const el = {
    type: 'beam',
    length_m: 5.0,
    depth_m: 0.35,
    width_m: 0.2,
    flush_with_ceiling: false,
    wall_adjacent: false
  };

  const result = calc.calculate(el);

  // Plaster = 2 sides (2 × 5 × 0.35 = 3.5) + soffit (0.2 × 5 = 1.0) = 4.5 m²
  const expectedPlaster = 2 * 5 * 0.35 + 0.2 * 5; // 3.5 + 1.0 = 4.5
  const passPlaster = Math.abs(result.plaster_area_m2 - expectedPlaster) < 0.001;
  if (!passPlaster) throw new Error(`Beam plaster: expected ${expectedPlaster}m², got ${result.plaster_area_m2}m²`);
  console.log(`  ✓ 5×0.2×0.35 beam → Plaster = ${result.plaster_area_m2} m² (expected ${expectedPlaster})`);

  // Paint should match plaster area
  const passPaint = Math.abs(result.paint_area_m2 - expectedPlaster) < 0.001;
  if (!passPaint) throw new Error(`Beam paint: expected ${expectedPlaster}m², got ${result.paint_area_m2}m²`);
  console.log(`  ✓ 5×0.2×0.35 beam → Paint  = ${result.paint_area_m2} m² (expected ${expectedPlaster})`);

  // Paint litres = area / 12
  const expectedLitres = expectedPlaster / 12;
  const passLitres = Math.abs(result.paint_litres - expectedLitres) < 0.001;
  if (!passLitres) throw new Error(`Beam paint litres: expected ${expectedLitres}L, got ${result.paint_litres}L`);
  console.log(`  ✓ 5×0.2×0.35 beam → Paint  = ${result.paint_litres.toFixed(4)} L (expected ${expectedLitres.toFixed(4)})`);

  // Screed, tiling, skirting should be 0 for beams
  if (result.screed_volume_m3 !== 0) throw new Error('Beam should have 0 screed');
  if (result.tiling_area_m2 !== 0) throw new Error('Beam should have 0 tiling');
  if (result.skirting_length_m !== 0) throw new Error('Beam should have 0 skirting');
  console.log('  ✓ Beam: screed=0, tiling=0, skirting=0 — correct');

  return 'PASS';
}

// ── Beam flush with ceiling ────────────────────────────────
function testBeamFlushCeiling() {
  const el = {
    type: 'beam',
    length_m: 4.0,
    depth_m: 0.3,
    width_m: 0.2,
    flush_with_ceiling: true
  };

  const result = calc.calculate(el);

  // Only sides: 2 × 4 × 0.3 = 2.4 m² (soffit excluded)
  const expected = 2 * 4 * 0.3; // 2.4
  const pass = Math.abs(result.plaster_area_m2 - expected) < 0.001;
  if (!pass) throw new Error(`Flush beam plaster: expected ${expected}m², got ${result.plaster_area_m2}m²`);
  console.log(`  ✓ Beam flush with ceiling → Plaster = ${result.plaster_area_m2} m² (sides only, no soffit)`);

  return 'PASS';
}

// ── 4m × 3m slab, 125mm thick, with 0.25m column ──────────
function testSlabScreedWithColumnDeduction() {
  const el = {
    type: 'slab',
    length_m: 4.0,
    width_m: 3.0,
    thickness_m: 0.125,
    columns: [{ width_m: 0.25, depth_m: 0.25 }],
    openings: [{ type: 'door', width_m: 0.9 }]
  };

  const result = calc.calculate(el);

  const grossArea = 4 * 3; // 12 m²
  const colFootprint = 0.25 * 0.25; // 0.0625 m² (below 0.1 threshold, so NOT deducted)
  const netArea = grossArea; // 12 m² (no deduction since 0.0625 < 0.1)
  const expectedScreedVol = netArea * 0.040; // 0.480 m³

  const passScreed = Math.abs(result.screed_volume_m3 - expectedScreedVol) < 0.001;
  if (!passScreed) throw new Error(`Slab screed: expected ${expectedScreedVol}m³, got ${result.screed_volume_m3}m³`);
  console.log(`  ✓ 4×3 slab screed  = ${result.screed_volume_m3} m³ (net area ${netArea}m² × 40mm)`);

  // Tiling = netArea × 1.05 waste, ÷ 0.16 (400×400), round up
  const expectedTilingArea = netArea * 1.05; // 12.6
  const expectedTileCount = Math.ceil(12.6 / 0.16); // ceil(78.75) = 79
  const passTilingArea = Math.abs(result.tiling_area_m2 - expectedTilingArea) < 0.001;
  const passTileCount = result.tile_count === expectedTileCount;
  if (!passTilingArea) throw new Error(`Slab tiling area: expected ${expectedTilingArea}m², got ${result.tiling_area_m2}m²`);
  if (!passTileCount) throw new Error(`Slab tile count: expected ${expectedTileCount}, got ${result.tile_count}`);
  console.log(`  ✓ 4×3 slab tiling  = ${result.tiling_area_m2} m², ${result.tile_count} tiles (400×400)`);

  // Skirting = perimeter - door opening
  const perimeter = 2 * (4 + 3); // 14m
  const doorWidth = 0.9;
  const expectedSkirting = perimeter - doorWidth; // 13.1m
  const passSkirting = Math.abs(result.skirting_length_m - expectedSkirting) < 0.001;
  if (!passSkirting) throw new Error(`Slab skirting: expected ${expectedSkirting}m, got ${result.skirting_length_m}m`);
  console.log(`  ✓ 4×3 slab skirting  = ${result.skirting_length_m} m (perimeter - door)`);

  return 'PASS';
}

// ── Slab with large column (deducted) ───────────────────────
function testSlabColumnFootprintDeduction() {
  const el = {
    type: 'slab',
    length_m: 5.0,
    width_m: 4.0,
    columns: [{ width_m: 0.4, depth_m: 0.4 }] // 0.16 m² > 0.1 → deducted
  };

  const result = calc.calculate(el);

  const gross = 20;
  const deducted = 0.16;
  const net = gross - deducted;
  const expectedScreed = net * 0.040;

  const pass = Math.abs(result.screed_volume_m3 - expectedScreed) < 0.001;
  if (!pass) throw new Error(`Column deduction screed: expected ${expectedScreed}m³, got ${result.screed_volume_m3}m³`);
  console.log(`  ✓ 5×4 slab with 0.4m column: screed = ${result.screed_volume_m3} m³ (deducted ${deducted}m²)`);
  if (!result.notes.some(n => n.includes('deduct'))) throw new Error('Expected deduction note');
  console.log('  ✓ Deduction note present');

  return 'PASS';
}

// ── Column wall-adjacent ──────────────────────────────────
function testColumnWallAdjacent() {
  const el = {
    type: 'column',
    height_m: 3.0,
    width_m: 0.3,
    depth_m: 0.3,
    wall_adjacent: true
  };

  const result = calc.calculate(el);

  // 2 exposed faces: height × (width + depth) × (exposed/2)
  // With exposed=2: area = 3 × (0.3+0.3) × (2/2) = 3 × 0.6 × 1 = 1.8 m²
  const expected = 3 * (0.3 + 0.3) * (2 / 2);
  const pass = Math.abs(result.plaster_area_m2 - expected) < 0.001;
  if (!pass) throw new Error(`Wall-adjacent column plaster: expected ${expected}m², got ${result.plaster_area_m2}m²`);
  console.log(`  ✓ Wall-adjacent column → Plaster = ${result.plaster_area_m2} m² (${2} faces)`);
  if (!result.notes.some(n => n.includes('wall-adjacent'))) throw new Error('Expected wall-adjacent note');
  console.log('  ✓ Wall-adjacent note present');

  return 'PASS';
}

// ── Ceiling finish (slab + beam soffit strips) ────────────
function testCeilingFinish() {
  const el = {
    type: 'slab',
    length_m: 6.0,
    width_m: 5.0,
    beams_below: [{ width_m: 0.3, length_m: 6.0 }]
  };

  const result = calc.calculate(el);
  const slabSoffit = 30;
  const beamStrips = 0.3 * 6; // 1.8
  const expected = slabSoffit + beamStrips;

  const pass = Math.abs(result.ceiling_finish_area_m2 - expected) < 0.001;
  if (!pass) throw new Error(`Ceiling finish: expected ${expected}m², got ${result.ceiling_finish_area_m2}m²`);
  console.log(`  ✓ Ceiling finish = ${result.ceiling_finish_area_m2} m² (soffit ${slabSoffit} + beam strips ${beamStrips})`);

  return 'PASS';
}

// ── Run ────────────────────────────────────────────────────
const tests = [testBeamPlasterAndPaint, testBeamFlushCeiling, testSlabScreedWithColumnDeduction, testSlabColumnFootprintDeduction, testColumnWallAdjacent, testCeilingFinish];
let passed = 0, failed = 0;
console.log('\n🧪 FinishCascadeCalculator Tests\n');
for (const t of tests) {
  try {
    const r = t();
    if (r === 'PASS') passed++;
    console.log(`  ✅ ${t.name}\n`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${t.name}: ${e.message}\n`);
  }
}
console.log(`\n${'─'.repeat(40)}\n✅ ${passed} passed, ❌ ${failed} failed${failed > 0 ? ' — FIX ME' : ' — all good!'}\n`);
