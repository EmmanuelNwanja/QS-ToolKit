const assert = require('assert');

// The referral controller imports the Supabase client at module load; provide
// dummy credentials so the client constructor succeeds in a pure test run.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.local';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';

const ctrl = require('../controllers/referralController');

// ── Golden vectors for the 60-day referral discount window ──────────

const DAY_MS = 24 * 60 * 60 * 1000;
const createdAt = '2026-01-01T00:00:00.000Z';
const createdMs = new Date(createdAt).getTime();

// inside the window
assert.strictEqual(ctrl.isWithinReferralDiscountWindow(createdAt, createdMs), true, 'at creation instant');
assert.strictEqual(ctrl.isWithinReferralDiscountWindow(createdAt, createdMs + 59 * DAY_MS), true, 'day 59 inside');
assert.strictEqual(ctrl.isWithinReferralDiscountWindow(createdAt, createdMs + 60 * DAY_MS), true, 'exactly day 60 is inside (inclusive)');

// outside the window
assert.strictEqual(ctrl.isWithinReferralDiscountWindow(createdAt, createdMs + 60 * DAY_MS + 1), false, 'one ms past day 60 is outside');
assert.strictEqual(ctrl.isWithinReferralDiscountWindow(createdAt, createdMs + 90 * DAY_MS), false, 'day 90 outside');

// invalid input never throws
assert.strictEqual(ctrl.isWithinReferralDiscountWindow(null, Date.now()), false, 'null createdAt');
assert.strictEqual(ctrl.isWithinReferralDiscountWindow('not-a-date', Date.now()), false, 'garbage createdAt');

console.log('referralDiscountWindow tests passed ✓');
