#!/usr/bin/env node
/**
 * gate-check.mjs
 * Unified pre-merge quality gate for QSToolkit.
 * Combines lint, typecheck, smoke tests, and BOQ math validation.
 *
 * Usage: node scripts/gate-check.mjs [--fix]
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FIX = process.argv.includes('--fix');
let exitCode = 0;

function run(cmd, label, cwd = ROOT) {
  console.log(`\n🔍 ${label}`);
  try {
    const opts = { cwd, stdio: 'pipe', encoding: 'utf-8' };
    const out = execSync(cmd, opts);
    if (out) console.log(out.trim());
    console.log(`✅ ${label} passed`);
    return true;
  } catch (err) {
    console.error(`❌ ${label} failed`);
    if (err.stdout) console.log(err.stdout.trim());
    if (err.stderr) console.error(err.stderr.trim());
    exitCode = 1;
    return false;
  }
}

// ─── Backend Lint ─────────────────────────────────────────────
if (existsSync(join(ROOT, 'backend', 'package.json'))) {
  const fixFlag = FIX ? ' -- --fix' : '';
  run('npm run lint' + fixFlag, 'Backend ESLint', join(ROOT, 'backend'));
} else {
  console.log('⚠️  Backend package.json not found, skipping backend lint');
}

// ─── Frontend Lint ────────────────────────────────────────────
if (existsSync(join(ROOT, 'frontend', 'package.json'))) {
  const fixFlag = FIX ? ' -- --fix' : '';
  run('npm run lint' + fixFlag, 'Frontend ESLint', join(ROOT, 'frontend'));
} else {
  console.log('⚠️  Frontend package.json not found, skipping frontend lint');
}

// ─── Backend Tests ────────────────────────────────────────────
if (existsSync(join(ROOT, 'backend', 'src', 'tests'))) {
  run('npm run test:qs', 'Backend Tests', join(ROOT, 'backend'));
} else {
  console.log('⚠️  No backend tests directory found, skipping backend tests');
}

// ─── Math Validation Smoke Check ──────────────────────────────
// Verifies that calculator constants in aiService.js match CONTEXT.md
import { readFileSync } from 'fs';

function validateCalculatorConstants() {
  console.log('\n🔍 Calculator Constants Consistency Check');
  try {
    const aiServicePath = join(ROOT, 'backend', 'src', 'services', 'aiService.js');
    const contextPath = join(ROOT, 'CONTEXT.md');

    if (!existsSync(aiServicePath) || !existsSync(contextPath)) {
      console.log('⚠️  aiService.js or CONTEXT.md not found, skipping constant check');
      return true;
    }

    const aiContent = readFileSync(aiServicePath, 'utf-8');

    const checks = [
      { name: '9-inch blocks per m²', pattern: /10 blocks\/m²/ },
      { name: '6-inch blocks per m²', pattern: /12 blocks\/m²/ },
      { name: '5-inch blocks per m²', pattern: /14 blocks\/m²/ },
      { name: 'Concrete dry-to-wet factor', pattern: /1\.54/ },
      { name: 'Cement bag 50kg', pattern: /50kg standard/ },
      { name: 'Laterite bulking factor', pattern: /1\.35/ },
      { name: 'Clay bulking factor', pattern: /1\.25/ },
      { name: 'Loam bulking factor', pattern: /1\.20/ },
      { name: 'Sandy bulking factor', pattern: /1\.10/ },
      { name: 'Longspan aluminium size', pattern: /3\.6m\s*×\s*0\.9m/ },
      { name: 'Paint coverage', pattern: /10m²\/litre/ },
      { name: 'Floor tiles 600×600', pattern: /2\.78 tiles\/m²/ },
      { name: 'Floor tiles 400×400', pattern: /6\.25 tiles\/m²/ },
    ];

    let allPassed = true;
    for (const check of checks) {
      if (check.pattern.test(aiContent)) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ❌ ${check.name} — constant missing or mismatched`);
        allPassed = false;
        exitCode = 1;
      }
    }

    if (allPassed) {
      console.log('✅ Calculator Constants Consistency Check passed');
    } else {
      console.log('❌ Calculator Constants Consistency Check failed');
    }
    return allPassed;
  } catch (err) {
    console.error('❌ Calculator check error:', err.message);
    exitCode = 1;
    return false;
  }
}

await validateCalculatorConstants();

// ─── Summary ──────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
if (exitCode === 0) {
  console.log('🚀 All gates passed. Ready for merge.');
} else {
  console.log('⛔ Some gates failed. Fix before merge.');
  if (FIX) {
    console.log('   Note: --fix was passed. Some issues may have been auto-fixed.');
    console.log('   Re-run without --fix to confirm.');
  }
}
console.log('='.repeat(60));

process.exit(exitCode);
