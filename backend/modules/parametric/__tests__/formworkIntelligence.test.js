const FormworkIntelligence = require('../services/FormworkIntelligence');

const fw = new FormworkIntelligence();

// ── Beam type detection ─────────────────────────────────────
function testBeamTypeIsolated() {
  const beam = { type: 'beam', length_m: 5, depth_m: 0.5, width_m: 0.25, beam_type: 'isolated' };
  const type = fw.beamFormworkType(beam);
  if (type !== 'isolated') throw new Error(`Expected 'isolated', got '${type}'`);
  const area = fw.beamFormworkArea(beam);
  const expectedSides = 2 * 5 * 0.5;
  const expectedSoffit = 0.25 * 5;
  const expectedEnds = 2 * 0.25 * 0.5;
  const expectedTotal = expectedSides + expectedSoffit + expectedEnds;
  if (Math.abs(area.total_m2 - expectedTotal) > 0.001) {
    throw new Error(`Isolated beam formwork: expected ${expectedTotal}m², got ${area.total_m2}m²`);
  }
  console.log(`  ✓ Isolated beam: ${area.type}, ${area.total_m2} m² (sides ${area.sides_m2} + soffit ${area.soffit_m2} + ends ${area.ends_m2})`);
  return 'PASS';
}

function testBeamTypeSlabAdjacent() {
  const beam = { type: 'beam', length_m: 5, depth_m: 0.4, width_m: 0.25, beam_type: 'lateral' };
  const type = fw.beamFormworkType(beam);
  if (type !== 'slab-adjacent') throw new Error(`Expected 'slab-adjacent', got '${type}'`);
  const area = fw.beamFormworkArea(beam);
  const expectedSides = 2 * 5 * 0.4;
  const expectedSoffit = 0.25 * 5;
  const expectedTotal = expectedSides + expectedSoffit;
  if (Math.abs(area.total_m2 - expectedTotal) > 0.001) {
    throw new Error(`Slab-adjacent beam formwork: expected ${expectedTotal}m², got ${area.total_m2}m²`);
  }
  console.log(`  ✓ Slab-adjacent beam: ${area.type}, ${area.total_m2} m² (sides ${area.sides_m2} + soffit ${area.soffit_m2})`);
  return 'PASS';
}

function testBeamTypeWallAdjacent() {
  const beam = { type: 'beam', length_m: 4, depth_m: 0.35, width_m: 0.2, adjacent_to: 'wall' };
  const type = fw.beamFormworkType(beam);
  if (type !== 'wall-adjacent') throw new Error(`Expected 'wall-adjacent', got '${type}'`);
  const area = fw.beamFormworkArea(beam);
  const expectedSide = 4 * 0.35;
  const expectedSoffit = 0.2 * 4;
  const expectedOppSide = 4 * 0.35;
  const expectedTotal = expectedSide + expectedSoffit + expectedOppSide;
  if (Math.abs(area.total_m2 - expectedTotal) > 0.001) {
    throw new Error(`Wall-adjacent beam formwork: expected ${expectedTotal}m², got ${area.total_m2}m²`);
  }
  console.log(`  ✓ Wall-adjacent beam: ${area.type}, ${area.total_m2} m² (side ${area.exposed_side_m2} + soffit ${area.soffit_m2} + opp ${area.opposite_side_m2})`);
  return 'PASS';
}

// ── Slab props ──────────────────────────────────────────────
function testSlabProps() {
  const slab = { type: 'slab', length_m: 6, width_m: 4 };
  const props = fw.slabProps(slab);
  const area = 6 * 4;
  const spacing = 1.0;
  const expected = Math.ceil(area / (spacing * spacing));
  if (props.count !== expected) throw new Error(`Slab props: expected ${expected}, got ${props.count}`);
  console.log(`  ✓ Slab ${area}m² → ${props.count} props @ ${props.spacing_m}m grid`);
  return 'PASS';
}

// ── Beam props ──────────────────────────────────────────────
function testBeamProps() {
  const beam = { type: 'beam', length_m: 5.5 };
  const props = fw.beamProps(beam);
  const expected = Math.floor(5.5 / 0.8) + 1; // 6 + 1 = 7
  if (props.count !== expected) throw new Error(`Beam props: expected ${expected}, got ${props.count}`);
  console.log(`  ✓ Beam ${beam.length_m}m → ${props.count} props @ ${props.spacing_m}m spacing`);
  return 'PASS';
}

// ── Column/wall ties ────────────────────────────────────────
function testColumnTies() {
  const col = { type: 'column', height_m: 3.0, width_m: 0.45, depth_m: 0.45 };
  const ties = fw.ties(col);
  // height → col.length_m falls back to width_m = 0.45
  // rows = ceil(3/0.6) = 5, cols = ceil(0.45/0.6) = 1, count = 5
  const expectedRows = Math.ceil(3 / 0.6);  // 5
  const expectedCols = Math.ceil(0.45 / 0.6); // 1
  const expected = expectedRows * expectedCols; // 5
  if (ties.count !== expected) throw new Error(`Column ties: expected ${expected}, got ${ties.count}`);
  console.log(`  ✓ Column 3m×0.45m → ${ties.count} ties (${ties.rows} rows × ${ties.cols} cols)`);
  return 'PASS';
}

function testWallTies() {
  const wall = { type: 'wall', height_m: 3.6, length_m: 8.0 };
  const ties = fw.ties(wall);
  const expectedRows = Math.ceil(3.6 / 0.6);  // 6
  const expectedCols = Math.ceil(8.0 / 0.6);  // 14
  const expected = expectedRows * expectedCols;  // 84
  if (ties.count !== expected) throw new Error(`Wall ties: expected ${expected}, got ${ties.count}`);
  console.log(`  ✓ Wall 3.6×8m → ${ties.count} ties (${ties.rows} rows × ${ties.cols} cols)`);
  return 'PASS';
}

// ── Plywood optimisation ────────────────────────────────────
function testPlywood() {
  const totalFormworkM2 = 100;
  const ply = fw.plywoodOptimization(totalFormworkM2);

  const sheetArea = 1.220 * 2.440;
  const gross = 100 * 1.10;
  const sheetsPerUse = Math.ceil(gross / sheetArea);
  const sheetsPerCycle = Math.max(1, Math.ceil(sheetsPerUse / 8));

  if (ply.sheets_required_per_use !== sheetsPerUse) {
    throw new Error(`Plywood sheets per use: expected ${sheetsPerUse}, got ${ply.sheets_required_per_use}`);
  }
  if (ply.sheets_per_replacement_cycle !== sheetsPerCycle) {
    throw new Error(`Plywood per cycle: expected ${sheetsPerCycle}, got ${ply.sheets_per_replacement_cycle}`);
  }
  console.log(`  ✓ 100m² formwork → ${sheetsPerUse} sheets/use, ${sheetsPerCycle} sheets/cycle (${ply.reuse_cycles}x reuse)`);
  return 'PASS';
}

function testPlywoodReuseCycle() {
  const fw2 = new FormworkIntelligence({ plywoodReuseCycles: 4 });
  const ply = fw2.plywoodOptimization(50);
  const sheetArea = 1.220 * 2.440;
  const gross = 50 * 1.10;
  const sheetsPerUse = Math.ceil(gross / sheetArea);
  const sheetsPerCycle = Math.max(1, Math.ceil(sheetsPerUse / 4));
  if (ply.sheets_per_replacement_cycle !== sheetsPerCycle) {
    throw new Error(`4-cycle plywood: expected ${sheetsPerCycle}, got ${ply.sheets_per_replacement_cycle}`);
  }
  console.log(`  ✓ 50m² with 4 reuses → ${sheetsPerUse} sheets/use, ${sheetsPerCycle} sheets/cycle`);
  return 'PASS';
}

// ── Run ────────────────────────────────────────────────────
const tests = [testBeamTypeIsolated, testBeamTypeSlabAdjacent, testBeamTypeWallAdjacent, testSlabProps, testBeamProps, testColumnTies, testWallTies, testPlywood, testPlywoodReuseCycle];
let passed = 0, failed = 0;
console.log('\n🧪 FormworkIntelligence Tests\n');
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
