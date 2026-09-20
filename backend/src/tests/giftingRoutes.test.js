/**
 * Gifting route tests (V1.20).
 *
 * Reproduces the production bug: a donor selecting members from the directory
 * card grid sends recipient_ids (cards carry masked emails only), while the
 * route validator demanded a non-empty recipient_emails array → HTTP 422
 * "Validation failed" before the controller ever ran.
 *
 * The contract (per giftingController.initiateGift) is: at least one recipient
 * via recipient_ids OR recipient_emails — never both required.
 *
 * Run with: node src/tests/giftingRoutes.test.js
 * (plain node:assert harness, same style as giftSubscriptionService.test.js)
 */

const assert = require('assert');
const express = require('express');

// ── Stubs installed BEFORE the route module loads ──────────────
// Supabase client is created at require time in config/supabase.js — stub it.
const supabasePath = require.resolve('../config/supabase');
function chainable(result) {
  const q = {
    select: () => q, insert: () => q, update: () => q, upsert: () => q,
    eq: () => q, neq: () => q, in: () => q, gte: () => q, lte: () => q,
    ilike: () => q, is: () => q, or: () => q, contains: () => q, not: () => q,
    order: () => q, range: () => q, limit: () => q,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (onFulfilled) => Promise.resolve(result).then(onFulfilled),
  };
  return q;
}
require.cache[supabasePath] = {
  id: supabasePath, filename: supabasePath, loaded: true,
  exports: {
    from() { return chainable({ data: null, error: null }); },
    rpc() { return chainable({ data: null, error: null }); },
  },
};

// express-rate-limit would rate-limit across test runs; swap in pass-throughs.
const rateLimiterPath = require.resolve('../middlewares/rateLimiter');
require.cache[rateLimiterPath] = {
  id: rateLimiterPath, filename: rateLimiterPath, loaded: true,
  exports: {
    generalLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    paymentLimiter: (req, res, next) => next(),
    webhookLimiter: (req, res, next) => next(),
  },
};

// adminMiddleware (required by giftingRoutes for the admin analytics route)
// reads JWT secrets outside development mode — force development for the test.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const giftingRoutes = require('../routes/giftingRoutes');

// ── Express harness (no HTTP server — app.handle drives the stack) ──
const app = express();
// NOTE: no body parser — tests supply req.body directly.
app.use('/api/v1/gifting', giftingRoutes);
// Sentinel: reached only when the route's own chain calls next() through it.
app.use((req, res, next) => { req._passedValidation = true; next(); });
// Error sink: mirrors an express error-path response.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(err.status || err.statusCode || 500)
    .json({ success: false, message: err.message, errors: err.errors || [] });
});

/**
 * POST an initiate payload through the real Express stack.
 * The returned promise settles on the first response OR when the stack
 * falls through (a middleware responded without calling next()).
 */
async function postInitiate(body) {
  let settle;
  const settled = new Promise((resolve) => { settle = resolve; });

  const req = {
    method: 'POST',
    url: '/api/v1/gifting/initiate',
    headers: { host: 'localhost' },
    query: {},
    cookies: {},
    body,
  };
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; settle(); return this; },
    end() { settle(); return this; },
  };

  await Promise.race([
    new Promise((resolve) => app.handle(req, res, resolve)),
    settled,
  ]);
  return { res, passedValidation: req._passedValidation === true };
}

async function run() {
  let passed = 0;
  const test = async (name, fn) => {
    try {
      await fn();
      passed += 1;
      console.log(`  ✔ ${name}`);
    } catch (err) {
      console.error(`  ✘ ${name}`);
      console.error(err.stack || err);
      process.exitCode = 1;
    }
  };

  // Variant-valid RFC4122 UUIDs (version 4, variant 8) — isUUID() rejects
  // strings like '1111…1111' because the variant nibble is invalid.
  const VALID_IDS = ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', '123e4567-e89b-42d3-a456-426614174000'];

  // In this route ONLY the `validate` middleware produces the 422
  // "Validation failed" shape; the controller signals business-rule rejections
  // with 400s. So 422 = validators rejected, anything else = chain passed.
  const validationFailed = (res) =>
    res.statusCode === 422 && res.body?.message === 'Validation failed';

  await test('POST /initiate route is wired on giftingRoutes', async () => {
    const layer = giftingRoutes.stack.find(
      (l) => l.route && l.route.path === '/initiate' && l.route.methods.post
    );
    assert.ok(layer, 'POST /initiate route must exist');
    assert.ok(layer.route.stack.length >= 3, 'route must have limiter, validators and controller');
  });

  await test('route validators: recipient_ids-only payload does NOT 422 (production bug)', async () => {
    const { res } = await postInitiate({
      recipient_ids: VALID_IDS,
      recipient_emails: [],
      plan_name: 'basic',
      billing_cycle: 'monthly',
      is_anonymous: false,
      donor_name: 'Henry Donor',
      donor_email: 'donor@example.com',
    });
    assert.ok(!validationFailed(res),
      `ids-only payload must pass validation (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  await test('route validators: emails-only payload still passes (backward compatible)', async () => {
    const { res } = await postInitiate({
      recipient_emails: ['friend@example.com'],
      plan_name: 'pro',
      billing_cycle: 'annual',
      is_anonymous: true,
    });
    assert.ok(!validationFailed(res),
      `emails-only payload must pass validation (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  await test('route validators: both empty → 422 Validation failed (still enforced)', async () => {
    const { res } = await postInitiate({
      recipient_emails: [],
      recipient_ids: [],
      plan_name: 'basic',
      billing_cycle: 'monthly',
    });
    assert.ok(validationFailed(res),
      `empty recipients must be rejected with 422 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  await test('route validators: invalid plan_name → 422', async () => {
    const { res } = await postInitiate({
      recipient_ids: VALID_IDS,
      plan_name: 'enterprise',
      billing_cycle: 'monthly',
    });
    assert.ok(validationFailed(res),
      `invalid plan must be rejected with 422 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  await test('route validators: malformed recipient_ids element → 422', async () => {
    const { res } = await postInitiate({
      recipient_ids: ['not-a-uuid'],
      plan_name: 'basic',
      billing_cycle: 'monthly',
      is_anonymous: true,
    });
    assert.ok(validationFailed(res),
      `non-UUID ids must be rejected with 422 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  await test('route validators: billing_cycle may be omitted (controller defaults to monthly)', async () => {
    const { res } = await postInitiate({
      recipient_ids: VALID_IDS,
      plan_name: 'basic',
      is_anonymous: true,
    });
    assert.ok(!validationFailed(res),
      `billing_cycle is optional at validation (controller defaults it; got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  console.log(`\n${passed} passed`);
}

run().catch((err) => { console.error(err); process.exit(1); });
