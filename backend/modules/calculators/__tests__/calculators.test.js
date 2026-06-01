const assert = require('assert');
const ConcreteService = require('../services/ConcreteService');
const MasonryService = require('../services/MasonryService');
const PlasteringService = require('../services/PlasteringService');
const PaintService = require('../services/PaintService');
const RoofingService = require('../services/RoofingService');
const SteelService = require('../services/SteelService');
const EarthworkService = require('../services/EarthworkService');
const TilingService = require('../services/TilingService');
const CarpentryService = require('../services/CarpentryService');
const FormworkService = require('../services/FormworkService');
const RoofAccessoriesService = require('../services/RoofAccessoriesService');
const DoorWindowService = require('../services/DoorWindowService');
const BrcDpmService = require('../services/BrcDpmService');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`✗ ${name}\n  ${e.message}`); }
}

// ─── Concrete ─────────────────────────────────────────────────────
function testConcreteSlab() {
  const r = ConcreteService.calculate({
    elements: [{ type: 'slab', name: 'Floor', length: 5, width: 4, thickness: 0.15 }],
    mix_ratio: '1:2:4', wastage_percent: 5
  });
  assert.strictEqual(r.elements.length, 1);
  assert.ok(r.elements[0].volume_m3 > 2.5 && r.elements[0].volume_m3 < 3.5);
  assert.ok(r.summary.materials.cement_bags_50kg > 0);
}

function testConcreteMultipleElements() {
  const r = ConcreteService.calculate({
    elements: [
      { type: 'column', name: 'Col A', width: 0.3, depth: 0.3, height: 3, count: 4 },
      { type: 'beam', name: 'Beam 1', width: 0.225, depth: 0.45, length: 5, count: 2 }
    ]
  });
  assert.strictEqual(r.elements.length, 2);
  assert.ok(r.summary.net_volume_m3 > 0);
}

function testConcreteEmpty() {
  const r = ConcreteService.calculate({ elements: [] });
  assert.strictEqual(r.summary.net_volume_m3, 0);
}

// ─── Masonry ──────────────────────────────────────────────────────
function testMasonryBlockwork() {
  const r = MasonryService.calculate({
    walls: [{ name: 'Wall A', length: 10, height: 3, openings: [{ width: 1.2, height: 2.1 }] }],
    block_size: '9inch'
  });
  assert.strictEqual(r.walls.length, 1);
  assert.ok(r.walls[0].deductions_m2 > 2);
  assert.ok(r.summary.blocks_needed > 200);
}

function testMasonryNoMortar() {
  const r = MasonryService.calculate({
    walls: [{ name: 'W', length: 5, height: 3 }],
    include_mortar: false
  });
  assert.strictEqual(r.summary.mortar, null);
}

// ─── Plastering ───────────────────────────────────────────────────
function testPlasteringWithOpenings() {
  const r = PlasteringService.calculate({
    surfaces: [{ name: 'Wall A', length: 10, height: 3, openings: [{ width: 1.2, height: 2.1 }] }],
    thickness_mm: 15, wastage_percent: 10
  });
  assert.ok(r.surfaces[0].net_area_m2 < 28);
  assert.ok(r.summary.materials.cement_bags_50kg > 0);
}

// ─── Paint ────────────────────────────────────────────────────────
function testPaintWithPrimer() {
  const r = PaintService.calculate({
    surfaces: [{ name: 'Room A', length: 10, height: 3, openings: [{ width: 1.2, height: 2.1 }] }],
    coats: 2, include_primer: true
  });
  assert.ok(r.summary.paint_litres_required > 0);
  assert.ok(r.summary.primer_litres > 0);
  assert.ok(r.summary.suggested_tins['5L_tins'] >= 0);
}

function testPaintNoPrimer() {
  const r = PaintService.calculate({
    surfaces: [{ name: 'R', length: 5, height: 3, openings: [] }],
    include_primer: false
  });
  assert.strictEqual(r.summary.primer_litres, 0);
}

// ─── Roofing ──────────────────────────────────────────────────────
function testRoofingGable() {
  const r = RoofingService.calculate({ roof_type: 'gable', length: 10, width: 8, pitch_degrees: 25 });
  assert.ok(r.summary.actual_roof_area_m2 > r.summary.plan_area_m2);
  assert.ok(r.summary.sheets.quantity_needed > 0);
}

function testRoofingFlat() {
  const r = RoofingService.calculate({ roof_type: 'flat', length: 10, width: 8 });
  assert.strictEqual(r.summary.actual_roof_area_m2, 80);
}

// ─── Steel ────────────────────────────────────────────────────────
function testSteelRebarWeight() {
  const r = SteelService.calculate({
    bars: [
      { diameter_mm: 12, length_m: 6, quantity: 10 },
      { diameter_mm: 16, length_m: 12, quantity: 5 }
    ]
  });
  assert.strictEqual(r.bars.length, 2);
  assert.ok(r.summary.total_weight_kg > 0);
  assert.ok(Math.abs(r.bars[0].total_weight_kg - 53.28) < 1);
}

function testSteelEmpty() {
  const r = SteelService.calculate({ bars: [] });
  assert.strictEqual(r.summary.total_weight_kg, 0);
}

// ─── Earthwork ────────────────────────────────────────────────────
function testEarthworkTrench() {
  const r = EarthworkService.calculate({
    sections: [{ name: 'Trench 1', length: 20, width: 0.675, depth: 1.0 }],
    soil_type: 'loam', working_space_mm: 300
  });
  assert.ok(r.sections[0].excavation_in_situ_m3 > 0);
  assert.ok(r.summary.truck_loads_5t > 0);
}

function testEarthworkBulking() {
  const loam = EarthworkService.calculate({ sections: [{ name: 'S', length: 10, width: 0.675, depth: 1 }], soil_type: 'loam' });
  const clay = EarthworkService.calculate({ sections: [{ name: 'S', length: 10, width: 0.675, depth: 1 }], soil_type: 'clay' });
  assert.ok(clay.summary.bulking_factor > loam.summary.bulking_factor);
}

// ─── Tiling ───────────────────────────────────────────────────────
function testTiling60x60() {
  const r = TilingService.calculate({ rooms: [{ name: 'Living', length: 6, width: 4 }], tile_length_m: 0.6, tile_width_m: 0.6 });
  assert.strictEqual(r.rooms[0].area_m2, 24);
  assert.ok(r.summary.tiles_needed > 60);
  assert.strictEqual(r.summary.tiles_per_box, 4);
}

// ─── Carpentry ────────────────────────────────────────────────────
function testCarpentryHipped() {
  const r = CarpentryService.calculate({ building_length_mm: 12000, building_width_mm: 9000, pitch_degrees: 25, roof_type: 'hipped' });
  assert.ok(r.summary.wall_plate.total_length_m > 0);
  assert.ok(r.summary.rafters.quantity > 0);
  assert.ok(r.derived.ridge_height_m > 0);
}

function testCarpentryGableVsHippedFascia() {
  const common = { building_length_mm: 12000, building_width_mm: 9000, pitch_degrees: 25 };
  const gable = CarpentryService.calculate({ ...common, roof_type: 'gabled' });
  const hipped = CarpentryService.calculate({ ...common, roof_type: 'hipped' });
  assert.notStrictEqual(gable.summary.fascia_board.total_length_m, hipped.summary.fascia_board.total_length_m);
}

// ─── Formwork ─────────────────────────────────────────────────────
function testFormworkSlab() {
  const r = FormworkService.calculate({ slabs: [{ name: 'Floor', length_mm: 5000, width_mm: 4000 }] });
  assert.ok(Math.abs(r.results.slab_soffit.total_m2 - 20) < 0.1);
}

function testFormworkColumns() {
  const r = FormworkService.calculate({
    columns: [{ name: 'Col 1', width_mm: 300, depth_mm: 300, height_mm: 3000, quantity: 4 }]
  });
  assert.ok(Math.abs(r.results.columns.total_m2 - 14.4) < 0.1);
}

// ─── Roof Accessories ─────────────────────────────────────────────
function testRoofAccessoriesRidge() {
  const r = RoofAccessoriesService.calculate({ building_length_mm: 12000, building_width_mm: 9000, roof_type: 'hipped' });
  assert.ok(Math.abs(r.results.ridge_capping.length_m - 3) < 0.1);
  assert.strictEqual(r.results.hip_length.quantity, 4);
}

// ─── Door & Window ────────────────────────────────────────────────
function testDoorWindow() {
  const r = DoorWindowService.calculate({
    doors: [{ ref: 'D1', type: 'single_leaf_steel', width_mm: 900, height_mm: 2100, quantity: 2 }],
    windows: [{ ref: 'W1', type: 'sliding_aluminium', width_mm: 1200, height_mm: 1200, quantity: 3 }],
    burglary_proof: [{ ref: 'BP1', width_mm: 900, height_mm: 2100, quantity: 1 }]
  });
  assert.strictEqual(r.door_schedule.items.length, 1);
  assert.strictEqual(r.window_schedule.items.length, 1);
  assert.strictEqual(r.burglary_proof_schedule.items.length, 1);
  assert.strictEqual(r.door_schedule.total_quantity, 2);
  assert.strictEqual(r.window_schedule.total_quantity, 3);
  assert.ok(r.summary.total_opening_area_m2 > 0);
}

// ─── BRC Mesh / DPM ───────────────────────────────────────────────
function testBrcDpmBasic() {
  const r = BrcDpmService.calculate({ floor_areas: [{ name: 'Hall', length_mm: 10000, width_mm: 8000 }] });
  assert.strictEqual(r.net_floor_area_m2, 80);
  assert.ok(r.brc_mesh.area_required_m2 > 80);
  assert.ok(r.brc_mesh.total_weight_kg > 0);
}

function testBrcDpmVoids() {
  const r = BrcDpmService.calculate({
    floor_areas: [{ name: 'Main', length_mm: 10000, width_mm: 8000 }],
    voids: [{ name: 'Atrium', length_mm: 2000, width_mm: 2000 }]
  });
  assert.strictEqual(r.net_floor_area_m2, 76);
}

function testBrcDpmOversite() {
  const r = BrcDpmService.calculate({
    floor_areas: [{ name: 'Floor', length_mm: 6000, width_mm: 5000 }],
    include_oversite_concrete: true, oversite_thickness_mm: 150
  });
  assert.ok(r.oversite_concrete !== null);
  assert.ok(r.oversite_concrete.materials.cement_bags_50kg > 0);
}

function testBrcDpmExcludedDpm() {
  const r = BrcDpmService.calculate({ floor_areas: [{ name: 'R', length_mm: 5000, width_mm: 4000 }], include_dpm: false });
  assert.strictEqual(r.dpm, null);
}

function testBrcDpmLapFactor() {
  const noLap = BrcDpmService.calculate({ floor_areas: [{ name: 'F', length_mm: 5000, width_mm: 4000 }], brc_side_lap_mm: 0, brc_end_lap_mm: 0 });
  const withLap = BrcDpmService.calculate({ floor_areas: [{ name: 'F', length_mm: 5000, width_mm: 4000 }], brc_side_lap_mm: 100, brc_end_lap_mm: 200 });
  assert.ok(withLap.brc_mesh.area_required_m2 > noLap.brc_mesh.area_required_m2);
}

// ─── Run all ─────────────────────────────────────────────────────
function run() {
  console.log('\n🧮 Calculator Services — Golden Vector Tests\n');

  test('Concrete slab volume', testConcreteSlab);
  test('Concrete multiple elements', testConcreteMultipleElements);
  test('Concrete empty input', testConcreteEmpty);
  test('Masonry blockwork with openings', testMasonryBlockwork);
  test('Masonry no mortar', testMasonryNoMortar);
  test('Plastering with openings', testPlasteringWithOpenings);
  test('Paint with primer', testPaintWithPrimer);
  test('Paint no primer', testPaintNoPrimer);
  test('Roofing gable slope', testRoofingGable);
  test('Roofing flat', testRoofingFlat);
  test('Steel rebar weight', testSteelRebarWeight);
  test('Steel empty', testSteelEmpty);
  test('Earthwork trench', testEarthworkTrench);
  test('Earthwork bulking factor', testEarthworkBulking);
  test('Tiling 60x60', testTiling60x60);
  test('Carpentry hipped roof', testCarpentryHipped);
  test('Carpentry gable vs hipped fascia', testCarpentryGableVsHippedFascia);
  test('Formwork slab soffit', testFormworkSlab);
  test('Formwork columns', testFormworkColumns);
  test('Roof accessories ridge', testRoofAccessoriesRidge);
  test('Door & window schedule', testDoorWindow);
  test('BRC mesh basic', testBrcDpmBasic);
  test('BRC mesh voids', testBrcDpmVoids);
  test('BRC mesh oversite concrete', testBrcDpmOversite);
  test('BRC mesh excluded DPM', testBrcDpmExcludedDpm);
  test('BRC mesh lap factor', testBrcDpmLapFactor);

  const total = passed + failed;
  console.log(`\n${failed > 0 ? '❌' : '✅'} ${passed}/${total} calculator service tests passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = { run };

if (require.main === module) run();
