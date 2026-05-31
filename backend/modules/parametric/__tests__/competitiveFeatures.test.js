const CompetitiveFeatures = require('../services/CompetitiveFeatures');

const cf = new CompetitiveFeatures();

// ── 1. AI Suggest ────────────────────────────────────────────
function testAiSuggestNonModular() {
  const result = cf.aiSuggest(357, [300, 350, 400, 450], 'eurocode', 'beam');
  if (!result.suggested) throw new Error('Expected suggestion for 357mm');
  if (result.suggested_mm !== 350) throw new Error('Expected 350mm (closer), got ' + result.suggested_mm);
  if (result.delta_mm !== -7) throw new Error(`Expected delta -7, got ${result.delta_mm}`);
  console.log(`  ✓ 357mm → ${result.suggested_mm}mm (${result.direction}), delta ${result.delta_mm}mm`);
  return 'PASS';
}

function testAiSuggestAlreadyModular() {
  const result = cf.aiSuggest(400, [300, 350, 400, 450], 'eurocode', 'beam');
  if (result.suggested) throw new Error('Expected no suggestion for 400mm');
  console.log('  ✓ 400mm already modular — no suggestion');
  return 'PASS';
}

function testAiSuggestLowerBound() {
  const result = cf.aiSuggest(100, [150, 200, 250], 'aci', 'beam');
  if (!result.suggested) throw new Error('Expected suggestion for 100mm');
  if (result.suggested_mm !== 150) throw new Error('Expected 150mm (lower bound), got ' + result.suggested_mm);
  console.log(`  ✓ 100mm → ${result.suggested_mm}mm (lower bound, nearest available)`);
  return 'PASS';
}

function testAiSuggestUpperBound() {
  const result = cf.aiSuggest(600, [300, 350, 400, 450], 'aci', 'beam');
  if (!result.suggested) throw new Error('Expected suggestion for 600mm');
  if (result.suggested_mm !== 450) throw new Error('Expected 450mm (upper bound), got ' + result.suggested_mm);
  console.log(`  ✓ 600mm → ${result.suggested_mm}mm (upper bound, nearest available)`);
  return 'PASS';
}

// ── 2. Regional Material Library ─────────────────────────────
function testRegionalNigeria() {
  const costs = cf.regionalMaterialCosts('Nigeria');
  if (!costs || costs.currency !== 'NGN') throw new Error('Expected NGN currency for Nigeria');
  if (costs.concrete_grade_25_per_m3 !== 85000) throw new Error('Expected NGN 85,000/m³ concrete');
  console.log(`  ✓ Nigeria: concrete ₦${costs.concrete_grade_25_per_m3}/m³, rebar ₦${costs.rebar_per_kg}/kg`);
  return 'PASS';
}

function testRegionalUK() {
  const costs = cf.regionalMaterialCosts('United Kingdom');
  if (!costs || costs.currency !== 'GBP') throw new Error('Expected GBP currency for UK');
  console.log(`  ✓ UK: concrete £${costs.concrete_grade_25_per_m3}/m³, rebar £${costs.rebar_per_kg}/kg`);
  return 'PASS';
}

function testRegionalMaterialType() {
  const cost = cf.regionalMaterialCosts('NG', 'rebar_per_kg');
  if (cost !== 850) throw new Error(`Expected NGN 850/kg rebar, got ${cost}`);
  console.log(`  ✓ Nigeria rebar: ₦${cost}/kg`);
  return 'PASS';
}

// ── 3. Voice Input ──────────────────────────────────────────
function testVoiceBeam() {
  const r = cf.parseVoiceInput('Beam, 6 meters, simply supported');
  if (!r) throw new Error('Expected parse result');
  if (r.element_type !== 'beam') throw new Error(`Expected beam, got ${r.element_type}`);
  if (r.primary_dim_mm !== 6000) throw new Error(`Expected 6000mm, got ${r.primary_dim_mm}`);
  if (r.extra.support_type !== 'simply_supported') throw new Error(`Expected simply_supported, got ${r.extra.support_type}`);
  console.log(`  ✓ "Beam, 6 meters, simply supported" → ${r.element_type}, ${r.primary_dim_mm}mm, ${r.extra.support_type}`);
  return 'PASS';
}

function testVoiceCircularColumn() {
  const r = cf.parseVoiceInput('Circular column, 3 meters height');
  if (!r) throw new Error('Expected parse result');
  if (r.element_type !== 'circular_column') throw new Error(`Expected circular_column, got ${r.element_type}`);
  if (r.primary_dim_mm !== 3000) throw new Error(`Expected 3000mm, got ${r.primary_dim_mm}`);
  console.log(`  ✓ "Circular column, 3 meters height" → ${r.element_type}, ${r.primary_dim_mm}mm`);
  return 'PASS';
}

function testVoiceSlabACI() {
  const r = cf.parseVoiceInput('Slab, 5 meters, one-way, ACI 318');
  if (!r) throw new Error('Expected parse result');
  if (r.element_type !== 'slab') throw new Error(`Expected slab, got ${r.element_type}`);
  if (r.standard !== 'aci318') throw new Error(`Expected aci318, got ${r.standard}`);
  if (r.extra.support_type !== 'one_way') throw new Error(`Expected one_way, got ${r.extra.support_type}`);
  console.log(`  ✓ "Slab, 5 meters, one-way, ACI 318" → ${r.element_type}, std=${r.standard}, typology=${r.extra.support_type}`);
  return 'PASS';
}

function testVoiceDome() {
  const r = cf.parseVoiceInput('Dome shell, 10 meters base diameter');
  if (!r) throw new Error('Expected parse result');
  if (r.element_type !== 'dome_shell') throw new Error(`Expected dome_shell, got ${r.element_type}`);
  console.log(`  ✓ "Dome shell, 10 meters" → ${r.element_type}, ${r.primary_dim_mm}mm`);
  return 'PASS';
}

function testVoiceGibberish() {
  const r = cf.parseVoiceInput('What is the weather today?');
  if (r !== null) throw new Error('Expected null for non-construction input');
  console.log('  ✓ Gibberish → null (no element matched)');
  return 'PASS';
}

// ── 4. Export CSV ──────────────────────────────────────────
function testExportCsv() {
  const result = {
    derived: { depth_mm: 500, width_mm: 250 },
    quantities: { concrete_volume_m3: 1.25, formwork_m2: 6.5, reinforcement_kg: 150 },
    audit: [
      { rule_name: 'beam_min_depth', input: '6000/12', computed_value: 500, formula_trace: 'h = span/12 = 6000/12 = 500mm' }
    ]
  };
  const csv = cf.exportAuditToCsv(result);
  if (!csv.includes('beam_min_depth')) throw new Error('CSV should contain rule name');
  if (!csv.includes('Concrete')) throw new Error('CSV should contain quantities');
  console.log('  ✓ CSV export generated, includes rule trace + quantities');
  return 'PASS';
}

// ── 5. 3D Preview ──────────────────────────────────────────
function testThreeDBeam() {
  const scene = cf.threeDPreview('beam', { depth_mm: 500, width_mm: 250, length_m: 6 });
  if (scene.geometry !== 'BoxGeometry') throw new Error('Expected BoxGeometry');
  if (scene.annotations.length !== 3) throw new Error('Expected 3 annotations');
  console.log(`  ✓ Beam 3D scene: ${scene.geometry}, ${scene.annotations.length} annotations`);
  return 'PASS';
}

function testThreeDDome() {
  const scene = cf.threeDPreview('dome_shell', { sphere_radius_m: 6.25, rise_m: 2.5 });
  if (scene.geometry !== 'SphereGeometry') throw new Error('Expected SphereGeometry for dome');
  console.log(`  ✓ Dome 3D scene: ${scene.geometry}, R=${scene.dimensions.radius}m, h=${scene.dimensions.height}m`);
  return 'PASS';
}

// ── 6. Engineering Lock ─────────────────────────────────────
function testEngineeringLock() {
  const lock = cf.createEngineeringLock({
    calculation_id: 'abc-123',
    engineer_name: 'Engr. Adeyemi',
    engineer_id: 'user-456',
    pdf_url: 'https://example.com/structural-calc.pdf',
    notes: 'Beam depth increased due to deflection check',
    overridden_fields: ['depth_mm']
  });
  if (lock.badge !== 'Engineer Verified') throw new Error('Expected Engineer Verified badge');
  if (lock.status !== 'locked') throw new Error('Expected locked status');
  console.log(`  ✓ Engineering lock: "${lock.badge}", fields: ${lock.overridden_fields.join(', ')}`);
  return 'PASS';
}

// ── Run ─────────────────────────────────────────────────────
const tests = [
  testAiSuggestNonModular, testAiSuggestAlreadyModular, testAiSuggestLowerBound, testAiSuggestUpperBound,
  testRegionalNigeria, testRegionalUK, testRegionalMaterialType,
  testVoiceBeam, testVoiceCircularColumn, testVoiceSlabACI, testVoiceDome, testVoiceGibberish,
  testExportCsv, testThreeDBeam, testThreeDDome, testEngineeringLock
];
let passed = 0, failed = 0;
console.log('\n🧪 CompetitiveFeatures Tests\n');
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
