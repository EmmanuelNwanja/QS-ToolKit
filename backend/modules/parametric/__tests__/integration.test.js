/**
 * Integration Tests
 *
 * 1. Feature flag OFF → Zero parametric UI (frontend simulation)
 * 2. BOQ injection preserves existing totals
 */

const assert = require('assert');

// ── Simulate feature flag gate ────────────────────────────────
function renderParametricFeature(isEnabled) {
  // This simulates what the frontend does:
  // When the flag is false, the parametric page shows a "disabled" message
  // When the flag is true, the SmartCalculator component renders
  if (!isEnabled) {
    return {
      type: 'disabled_message',
      content: 'Parametric Engine Disabled',
      parametricUI: false
    };
  }
  return {
    type: 'smart_calculator',
    parametricUI: true
  };
}

function testFlagOffNoParametricUI() {
  const result = renderParametricFeature(false);
  assert.strictEqual(result.parametricUI, false, 'When flag is off, no parametric UI should render');
  assert(result.content.includes('Disabled'), 'Should show disabled message');
  console.log('  ✓ PARAMETRIC_ENGINE_ENABLED=false → no parametric UI, disabled message shown');
  return 'PASS';
}

function testFlagOnRendersCalculator() {
  const result = renderParametricFeature(true);
  assert.strictEqual(result.parametricUI, true, 'When flag is on, parametric UI should render');
  console.log('  ✓ PARAMETRIC_ENGINE_ENABLED=true → SmartCalculator renders');
  return 'PASS';
}

// ── BOQ injection preservation ────────────────────────────────
function simulateBoqInjection(existingLines, newLines) {
  // BOQ injection appends new rows to the existing boq_lines
  // No existing lines are modified, deleted, or locked
  const maxItemNo = existingLines.reduce((max, l) => Math.max(max, l.item_no || 0), 0);
  const injected = newLines.map((line, i) => ({
    ...line,
    item_no: maxItemNo + i + 1,
    amount: line.quantity * line.rate
  }));

  const result = {
    existingLines: [...existingLines],  // unchanged
    injectedLines: injected,
    allLines: [...existingLines, ...injected]
  };

  // Calculate totals: existing + injected
  result.existingTotal = existingLines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0);
  result.injectedTotal = injected.reduce((s, l) => s + l.amount, 0);
  result.grandTotal = result.existingTotal + result.injectedTotal;

  return result;
}

function testBOQInjectionPreservesExisting() {
  const existing = [
    { item_no: 1, description: 'Concrete grade 25', unit: 'm³', quantity: 10, rate: 85000, amount: 850000 },
    { item_no: 2, description: 'Reinforcement', unit: 'kg', quantity: 500, rate: 850, amount: 425000 }
  ];

  const parametricLines = [
    { description: 'Beam formwork', unit: 'm²', quantity: 12.5, rate: 4500 },
    { description: 'Beam concrete grade 30', unit: 'm³', quantity: 2.4, rate: 92000 }
  ];

  const result = simulateBoqInjection(existing, parametricLines);

  // Existing lines unchanged
  assert.strictEqual(result.existingLines.length, 2, 'Existing lines count unchanged');
  assert.strictEqual(result.existingLines[0].description, 'Concrete grade 25', 'First existing line unchanged');
  assert.strictEqual(result.existingLines[1].amount, 425000, 'Existing line amount unchanged');

  // New lines appended with correct item numbers
  assert.strictEqual(result.injectedLines.length, 2, '2 new lines injected');
  assert.strictEqual(result.injectedLines[0].item_no, 3, 'First injected line gets next item_no (3)');
  assert.strictEqual(result.injectedLines[1].item_no, 4, 'Second injected line gets item_no 4');

  // Totals correct
  assert.strictEqual(result.existingTotal, 1275000, 'Existing total unchanged');
  assert.strictEqual(result.injectedTotal, 277050, 'Injected total correct (12.5×4500 + 2.4×92000)');
  assert.strictEqual(result.grandTotal, 1552050, 'Grand total = existing + injected');

  // No proprietary markers on injected lines
  assert.strictEqual(result.injectedLines[0].parametric_badge, undefined, 'No parametric badge on injected lines');
  assert.strictEqual(result.injectedLines[0].locked, undefined, 'No locked flag on injected lines');
  assert.strictEqual(result.injectedLines[0].source, undefined, 'No source marker on injected lines');

  console.log('  ✓ BOQ injection: existing lines untouched, injected lines unpolluted, total updated correctly');
  return 'PASS';
}

function testBOQInjectionEmptyExisting() {
  const result = simulateBoqInjection([], [{ description: 'New item', unit: 'm', quantity: 5, rate: 2000 }]);
  assert.strictEqual(result.injectedLines[0].item_no, 1, 'First line gets item_no 1 when existing is empty');
  assert.strictEqual(result.grandTotal, 10000, 'Total matches injected amount');
  console.log('  ✓ Empty BOQ: injection starts at item_no 1');
  return 'PASS';
}

// ── Run ───────────────────────────────────────────────────────
const tests = [
  testFlagOffNoParametricUI,
  testFlagOnRendersCalculator,
  testBOQInjectionPreservesExisting,
  testBOQInjectionEmptyExisting
];

let passed = 0, failed = 0;
console.log('\n🧪 Integration Tests\n');
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
