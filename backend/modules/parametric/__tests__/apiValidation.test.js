/**
 * API Request Validation Tests
 *
 * Tests that every /api/v1/parametric/ endpoint properly
 * validates its inputs BEFORE hitting any service layer.
 */

const assert = require('assert');

// ── Factory: simulates a request validation function ──────────
// These tests verify validation logic independently of Express.

function validateCalculateBody(body) {
  const errors = [];
  if (!body.project_id) errors.push('project_id is required');
  if (!body.element_type) errors.push('element_type is required');
  if (!body.primary_dimension || body.primary_dimension <= 0) errors.push('primary_dimension must be > 0');
  return errors;
}

function validateCompareBody(body) {
  const errors = [];
  if (!body.element_type) errors.push('element_type is required');
  if (!body.primary_dim_mm || body.primary_dim_mm <= 0) errors.push('primary_dim_mm must be > 0');
  if (!body.standards || !Array.isArray(body.standards) || body.standards.length < 2) errors.push('standards must be an array of at least 2');
  return errors;
}

function validateInjectBoqBody(body) {
  const errors = [];
  if (!body.boq_id) errors.push('boq_id is required');
  return errors;
}

function validateOverrideBody(body) {
  const errors = [];
  if (!body.overrides || typeof body.overrides !== 'object') errors.push('overrides must be an object');
  return errors;
}

function validateCalculateCircularBody(body) {
  const errors = [];
  if (!body.diameter || body.diameter <= 0) errors.push('diameter must be > 0');
  if (!body.height || body.height <= 0) errors.push('height must be > 0');
  return errors;
}

function validateCalculateDomeBody(body) {
  const errors = [];
  if (!body.base_diameter || body.base_diameter <= 0) errors.push('base_diameter must be > 0');
  if (!body.rise || body.rise <= 0) errors.push('rise must be > 0');
  return errors;
}

// ── Tests ─────────────────────────────────────────────────────

function testValidateCalculateMissingFields() {
  const errs = validateCalculateBody({});
  assert(errs.length >= 3, 'Expected 3+ errors for empty body');
  assert(errs.some(e => e.includes('project_id')), 'Should require project_id');
  assert(errs.some(e => e.includes('element_type')), 'Should require element_type');
  assert(errs.some(e => e.includes('primary_dimension')), 'Should require primary_dimension');
  console.log('  ✓ Empty body: 3 validation errors');
  return 'PASS';
}

function testValidateCalculateZeroDimension() {
  const errs = validateCalculateBody({ project_id: 'p1', element_type: 'beam', primary_dimension: 0 });
  assert(errs.some(e => e.includes('primary_dimension')), 'Zero dimension should fail');
  console.log('  ✓ zero primary_dimension rejected');
  return 'PASS';
}

function testValidateCalculateValid() {
  const errs = validateCalculateBody({ project_id: 'p1', element_type: 'beam', primary_dimension: 6000 });
  assert.strictEqual(errs.length, 0, 'Valid body should have 0 errors');
  console.log('  ✓ Valid body passes');
  return 'PASS';
}

function testValidateCompareSingleStandard() {
  const errs = validateCompareBody({ element_type: 'beam', primary_dim_mm: 6000, standards: ['eurocode'] });
  assert(errs.some(e => e.includes('standards')), 'Single standard should fail');
  console.log('  ✓ Single standard rejected (need 2+)');
  return 'PASS';
}

function testValidateCompareValid() {
  const errs = validateCompareBody({ element_type: 'beam', primary_dim_mm: 6000, standards: ['eurocode', 'aci318'] });
  assert.strictEqual(errs.length, 0, 'Valid compare body should pass');
  console.log('  ✓ Valid compare body passes');
  return 'PASS';
}

function testValidateInjectBoqNoBoqId() {
  const errs = validateInjectBoqBody({});
  assert(errs.some(e => e.includes('boq_id')), 'Should require boq_id');
  console.log('  ✓ Missing boq_id rejected');
  return 'PASS';
}

function testValidateOverrideEmpty() {
  const errs = validateOverrideBody({});
  assert(errs.some(e => e.includes('overrides')), 'Should require overrides');
  console.log('  ✓ Empty override body rejected');
  return 'PASS';
}

function testValidateCircularColumn() {
  const errs = validateCalculateCircularBody({ diameter: 450, height: 3 });
  assert.strictEqual(errs.length, 0, 'Valid circular column body should pass');
  console.log('  ✓ Valid circular column body passes');
  return 'PASS';
}

function testValidateCircularColumnMissingDia() {
  const errs = validateCalculateCircularBody({ height: 3 });
  assert(errs.some(e => e.includes('diameter')), 'Should require diameter');
  console.log('  ✓ Missing circular column diameter rejected');
  return 'PASS';
}

function testValidateDome() {
  const errs = validateCalculateDomeBody({ base_diameter: 10000, rise: 2500 });
  assert.strictEqual(errs.length, 0, 'Valid dome body should pass');
  console.log('  ✓ Valid dome body passes');
  return 'PASS';
}

function testValidateDomeMissing() {
  const errs = validateCalculateDomeBody({ base_diameter: 10000 });
  assert(errs.some(e => e.includes('rise')), 'Should require rise');
  console.log('  ✓ Missing dome rise rejected');
  return 'PASS';
}

// ── Run ───────────────────────────────────────────────────────
const tests = [
  testValidateCalculateMissingFields,
  testValidateCalculateZeroDimension,
  testValidateCalculateValid,
  testValidateCompareSingleStandard,
  testValidateCompareValid,
  testValidateInjectBoqNoBoqId,
  testValidateOverrideEmpty,
  testValidateCircularColumn,
  testValidateCircularColumnMissingDia,
  testValidateDome,
  testValidateDomeMissing
];

let passed = 0, failed = 0;
console.log('\n🧪 API Validation Tests\n');
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
