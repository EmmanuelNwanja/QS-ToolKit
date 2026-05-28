#!/usr/bin/env node
/**
 * setup-triage-labels.mjs
 * Creates canonical GitHub issue labels for QSToolkit.
 *
 * Usage: node scripts/setup-triage-labels.mjs --owner OWNER --repo REPO --token TOKEN
 */

import { execSync } from 'child_process';

const OWNER = process.env.GITHUB_OWNER || process.argv.find((a, i) => process.argv[i - 1] === '--owner') || '';
const REPO = process.env.GITHUB_REPO || process.argv.find((a, i) => process.argv[i - 1] === '--repo') || '';
const TOKEN = process.env.GITHUB_TOKEN || process.argv.find((a, i) => process.argv[i - 1] === '--token') || '';

const LABELS = [
  // Priority
  { name: 'P0 🔴', color: 'b60205', description: 'Critical — blocks release' },
  { name: 'P1 🟠', color: 'd93f0b', description: 'High — should fix soon' },
  { name: 'P2 🟡', color: 'fbca04', description: 'Medium — fix when possible' },
  { name: 'P3 🟢', color: '0e8a16', description: 'Low — nice to have' },

  // Type
  { name: 'bug 🐛', color: 'd73a4a', description: 'Something is broken' },
  { name: 'feature ✨', color: 'a2eeef', description: 'New capability' },
  { name: 'enhancement 🔧', color: '84b6eb', description: 'Improve existing feature' },
  { name: 'refactor 🧹', color: 'c5def5', description: 'Code cleanup without behavior change' },
  { name: 'docs 📚', color: '0075ca', description: 'Documentation only' },
  { name: 'test 🧪', color: 'd876e3', description: 'Testing infrastructure or coverage' },

  // Domain
  { name: 'ai-engine 🤖', color: '5319e7', description: 'Dr. Q, Auto-BOQ, visual primitives' },
  { name: 'calculator 🧮', color: 'f9d0c4', description: 'QS calculator tools' },
  { name: 'boq 📋', color: 'bfd4f2', description: 'Bill of Quantities' },
  { name: 'invoice 💰', color: 'bfe5bf', description: 'Invoice generation and payment' },
  { name: 'payments 💳', color: '006b75', description: 'Paystack, subscriptions' },
  { name: 'integrity 🔐', color: '5319e7', description: 'Document certification, SHA-256' },
  { name: 'security 🛡️', color: 'ff7619', description: 'Auth, rate limits, data protection' },
  { name: 'performance ⚡', color: 'ffff00', description: 'Speed, memory, token cost' },
  { name: 'database 🗄️', color: 'c2e0c6', description: 'Migrations, schema, queries' },

  // Workflow
  { name: 'needs-triage 🔍', color: 'd4c5f9', description: 'Needs initial assessment' },
  { name: 'needs-repro 🔄', color: 'fef2c0', description: 'Waiting for reproduction steps' },
  { name: 'needs-design 🎨', color: 'c5def5', description: 'Waiting for design/spec' },
  { name: 'needs-review 👀', color: 'c2e0c6', description: 'PR waiting for review' },
  { name: 'blocked 🚧', color: 'e99695', description: 'Blocked by dependency or decision' },
  { name: 'wontfix 🚫', color: 'ffffff', description: 'Wont fix, by design' },
  { name: 'duplicate ♊', color: 'cfd3d7', description: 'Duplicate of another issue' },
];

async function main() {
  if (!OWNER || !REPO) {
    console.error('Usage: node scripts/setup-triage-labels.mjs --owner OWNER --repo REPO [--token TOKEN]');
    console.error('   Or set GITHUB_OWNER, GITHUB_REPO env vars');
    process.exit(1);
  }

  console.log(`Setting up labels for ${OWNER}/${REPO}...\n`);

  for (const label of LABELS) {
    try {
      const auth = TOKEN ? `-H "Authorization: token ${TOKEN}"` : '';
      const cmd = `curl -s -o /dev/null -w "%{http_code}" ${auth} \
        -X POST \
        -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/repos/${OWNER}/${REPO}/labels \
        -d '${JSON.stringify(label)}'`;
      const code = execSync(cmd, { encoding: 'utf-8' }).trim();
      if (code === '201') {
        console.log(`✅ Created: ${label.name}`);
      } else if (code === '422') {
        console.log(`⚠️  Already exists: ${label.name}`);
      } else {
        console.log(`❌ Failed (${code}): ${label.name}`);
      }
    } catch (err) {
      console.error(`❌ Error creating ${label.name}:`, err.message);
    }
  }

  console.log('\nDone.');
}

main();
