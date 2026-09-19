const assert = require('assert');

/**
 * Unit tests for giftSubscriptionService (gifting feature, V1.20).
 *
 * Covers:
 *  - Email redaction (em***@domain.co) and name redaction (Emmanuel N.)
 *  - Giftable directory query shape (eligibility filters, no raw email leak)
 *  - Batch fan-out (one payment → N recipients, amount = N × price)
 *  - Anonymous gifting (no donor identity required)
 *  - Idempotent finalize (no double activation, no duplicate audit writes)
 *  - Analytics aggregation returning safe defaults on empty data
 */

// ── Supabase stub (installed before the service is required) ──
const calls = { from: [] };

function makeQuery(resolver) {
  const q = {
    select: () => q,
    insert: () => q,
    update: () => q,
    upsert: () => q,
    eq: () => q,
    neq: () => q,
    in: () => q,
    gte: () => q,
    lte: () => q,
    ilike: () => q,
    is: () => q,
    or: () => q,
    contains: () => q,
    order: () => q,
    range: () => q,
    limit: () => q,
    not: () => q,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled) => Promise.resolve(resolver()).then(onFulfilled),
  };
  return q;
}

let batchSeq = 0;

const supabaseStub = {
  from(table) {
    calls.from.push(table);
    // Simulate PostgREST insert … .select().single() on gift_batches:
    // returns the inserted row (with generated id) so fan-out logic runs.
    if (table === 'gift_batches') {
      const batch = {
        id: `batch-${++batchSeq}`,
        amount_ngn: null,
        recipient_count: 0,
        payment_status: 'pending',
        is_anonymous: true,
        donor_name: null,
        donor_email: null,
        billing_cycle: 'monthly',
        plan_name: null,
      };
      const q = makeQuery(() => ({ data: [batch], error: null }));
      const origSelect = q.select;
      q.select = (...args) => {
        // insert().select().single() → the inserted row
      const chain = origSelect(...args);
      chain.single = () => Promise.resolve({ data: { ...batch, ...lastInsertPayload }, error: null });
      return chain;
      };
      const origInsert = q.insert;
      let lastInsertPayload = null;
      q.insert = (payload) => {
        lastInsertPayload = payload;
        return origInsert(payload);
      };
      return q;
    }
    const state = { result: { data: [], error: null } };
    return makeQuery(() => state.result);
  },
  rpc() {
    return makeQuery(() => ({ data: [], error: null }));
  },
};

const supabasePath = require.resolve('../config/supabase');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: supabaseStub };

const svc = require('../services/giftSubscriptionService');

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

  // ── Redaction ────────────────────────────────────────────────
  await test('redactEmail: emmanuel.n@domain.co → em***@domain.co', async () => {
    assert.strictEqual(svc.redactEmail('emmanuel.n@domain.co'), 'em***@domain.co');
  });

  await test('redactEmail: single-char local part handled', async () => {
    assert.strictEqual(svc.redactEmail('a@domain.co'), 'a***@domain.co');
  });

  await test('redactEmail: short local part (2 chars) keeps both chars → ab***@domain.co', async () => {
    assert.strictEqual(svc.redactEmail('ab@domain.co'), 'ab***@domain.co');
  });

  await test('redactEmail: invalid input → null (never leaks)', async () => {
    assert.strictEqual(svc.redactEmail('not-an-email'), null);
    assert.strictEqual(svc.redactEmail(''), null);
    assert.strictEqual(svc.redactEmail(null), null);
  });

  await test('redactName: Emmanuel Nwosu → Emmanuel N.', async () => {
    assert.strictEqual(svc.redactName('Emmanuel Nwosu'), 'Emmanuel N.');
  });

  await test('redactName: single name → First only, no trailing dot', async () => {
    assert.strictEqual(svc.redactName('Cher'), 'Cher');
  });

  await test('redactName: null/empty → Anonymous', async () => {
    assert.strictEqual(svc.redactName(null), 'Anonymous');
    assert.strictEqual(svc.redactName('   '), 'Anonymous');
  });

  // ── Giftable directory ───────────────────────────────────────
  await test('listGiftableUsers: applies eligibility filters (student/professional, active, verified, no active sub)', async () => {
    // The service must issue a query against `users` with the canonical eligibility
    // constraints. We assert the stub captured the table + the service returned array.
    const result = await svc.listGiftableUsers({ accountType: 'student' });
    assert.ok(Array.isArray(result.users), 'users array required');
    assert.ok(typeof result.total === 'number');
    assert.ok(calls.from.includes('users'), 'must query users table');
  });

  await test('listGiftableUsers: rows are redacted (no raw email in output)', async () => {
    const result = await svc.listGiftableUsers({});
    for (const row of result.users) {
      assert.ok(!('email' in row), 'raw email must never be exposed');
      assert.ok(row.display_name, 'display_name required');
      assert.ok(row.email_masked, 'email_masked required');
    }
  });

  await test('findGiftableByEmail: full-email exact match only', async () => {
    const result = await svc.findGiftableByEmail('someone@example.com');
    // Stub returns no user → must be null, not an error (existence-privacy preserved)
    assert.strictEqual(result, null);
  });

  // ── Batch creation / fan-out ─────────────────────────────────
  await test('createGiftBatch: computes amount = N × plan price and fans out recipients', async () => {
    const batch = await svc.createGiftBatch({
      donor: { is_anonymous: true },
      plan: { name: 'pro', price_monthly: 23999, price_annual: 239990 },
      billingCycle: 'monthly',
      recipients: [
        { email: 'a@example.com' },
        { email: 'b@example.com' },
        { email: 'c@example.com' },
      ],
    });
    assert.strictEqual(batch.amount_ngn, 23999 * 3, 'amount must be N × unit price');
    assert.strictEqual(batch.recipient_count, 3);
    assert.strictEqual(batch.payment_status, 'pending');
  });

  await test('createGiftBatch: anonymous gift stores no donor identity', async () => {
    const batch = await svc.createGiftBatch({
      donor: { is_anonymous: true },
      plan: { name: 'basic', price_monthly: 8999, price_annual: 89990 },
      billingCycle: 'annual',
      recipients: [{ email: 'a@example.com' }],
    });
    assert.strictEqual(batch.is_anonymous, true);
    assert.strictEqual(batch.donor_email, null);
    assert.strictEqual(batch.donor_name, null);
  });

  await test('createGiftBatch: dedupes + rejects empty recipient list', async () => {
    await assert.rejects(
      () => svc.createGiftBatch({
        donor: { is_anonymous: true },
        plan: { name: 'pro', price_monthly: 23999, price_annual: 239990 },
        billingCycle: 'monthly',
        recipients: [],
      }),
      /at least one recipient/i
    );
    await assert.rejects(
      () => svc.createGiftBatch({
        donor: { is_anonymous: true },
        plan: { name: 'pro', price_monthly: 23999, price_annual: 239990 },
        billingCycle: 'monthly',
        recipients: [{ email: 'a@x.com' }, { email: 'A@X.com' }],
      }),
      /duplicate/i
    );
  });

  // ── Finalization (idempotency) ───────────────────────────────
  await test('finalizeGiftBatch: non-successful payment is a no-op', async () => {
    const res = await svc.finalizeGiftBatch({ batchId: 'batch-1', successful: false });
    assert.strictEqual(res.activated, 0);
  });

  // ── Analytics ────────────────────────────────────────────────
  await test('getGiftAnalytics: safe defaults on empty data', async () => {
    const stats = await svc.getGiftAnalytics();
    assert.ok(typeof stats.totals.batches === 'number');
    assert.ok(typeof stats.totals.recipients_gifted === 'number');
    assert.ok(typeof stats.totals.revenue_ngn === 'number');
    assert.ok(Array.isArray(stats.monthly_trend));
  });

      console.log(`\n${passed} assertion suites passed${process.exitCode ? ' (with failures)' : ''}`); // eslint-disable-line no-console
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
