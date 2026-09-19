const assert = require('assert');

/**
 * Regression tests for adminGetReferralStats (production incident 2026-09-19).
 *
 * Production crashed with: TypeError: Cannot read properties of null (reading 'data')
 * Root cause: the get_top_referrers RPC is not defined in any migration, so
 * PostgREST 404s (PGRST202); combined with null resolution paths in the
 * Promise.all destructure, the endpoint 500s. The endpoint must NEVER throw
 * because a stats leg (counts or the optional top-referrers RPC) resolves null.
 */

// ── Stub the Supabase client BEFORE the controller is required ──
const stubState = {
  fromCalls: [],
  rpcCalls: [],
};

function makeCountResult(count, data = null) {
  return { data, count, error: null, status: 200, statusText: 'OK' };
}

const supabaseStub = {
  from(table) {
    stubState.fromCalls.push(table);
    return {
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      range() { return this; },
      limit() { return this; },
      single() { return Promise.resolve({ data: null, error: null }); },
      // head:true count queries resolve with { count, data: null }
      then(onFulfilled) { return Promise.resolve(makeCountResult(0)).then(onFulfilled); },
    };
  },
  rpc(fnName) {
    stubState.rpcCalls.push(fnName);
    // Reproduce the production failure: PostgREST function-not-found paths can
    // resolve null (or reject) depending on supabase-js version/build vintage.
    return stubState.rpcResolveValue !== undefined
      ? Promise.resolve(stubState.rpcResolveValue)
      : Promise.reject(new Error('Could not find the function get_top_referrers'));
  },
};

const Module = require('module');
const supabasePath = require.resolve('../config/supabase');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: supabaseStub };

const ctrl = require('../controllers/referralController');

// ── Minimal Express req/res doubles ──────────────────────────────
function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

async function run() {
  const req = { user: { id: 'admin-1' } };
  const next = () => { throw new Error('next(err) called — endpoint must not error'); };

  // Case 1: RPC rejects (function missing — current production behavior)
  {
    stubState.rpcResolveValue = undefined;
    const res = makeRes();
    await ctrl.adminGetReferralStats(req, res, next);
    assert.strictEqual(res.statusCode, 200, 'RPC rejection must not 500');
    assert.strictEqual(res.body.stats.total_signups, 0);
    assert.deepStrictEqual(res.body.stats.top_referrers, []);
    console.log('✓ RPC rejects (missing function) → 200 with empty top_referrers');
  }

  // Case 2: RPC resolves null (the production TypeError path)
  {
    stubState.rpcResolveValue = null;
    const res = makeRes();
    await ctrl.adminGetReferralStats(req, res, next);
    assert.strictEqual(res.statusCode, 200, 'null RPC resolution must not 500');
    assert.deepStrictEqual(res.body.stats.top_referrers, []);
    console.log('✓ RPC resolves null → 200 with empty top_referrers');
  }

  // Case 3: RPC resolves a valid payload — passthrough
  {
    stubState.rpcResolveValue = { data: [{ referrer_user_id: 'u1', total_signups: 4 }] };
    const res = makeRes();
    await ctrl.adminGetReferralStats(req, res, next);
    assert.strictEqual(res.body.stats.top_referrers.length, 1);
    assert.strictEqual(res.body.stats.top_referrers[0].referrer_user_id, 'u1');
    console.log('✓ RPC resolves payload → passed through to stats');
  }

  // Case 4: a count-leg builder resolves null when awaited — destructure must survive
  {
    stubState.rpcResolveValue = { data: [] };
    supabaseStub.from = () => {
      const nullResolving = { then: (onFulfilled) => Promise.resolve(null).then(onFulfilled) };
      return { select: () => ({ ...nullResolving, eq: () => nullResolving }) };
    };
    const res = makeRes();
    let threw = false;
    try {
      await ctrl.adminGetReferralStats(req, res, next);
    } catch (e) {
      threw = true;
    }
    supabaseStub.from = function restored(table) {
      stubState.fromCalls.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        then(onFulfilled) { return Promise.resolve(makeCountResult(0)).then(onFulfilled); },
      };
    };
    assert.strictEqual(threw, false, 'null count legs must not crash the endpoint');
    assert.strictEqual(res.body.stats.total_signups, 0);
    console.log('✓ null count legs → 200 with zeroed stats');
  }

  console.log('adminReferralStats regression tests passed ✓');
}

run().catch((err) => { console.error('TEST FAILURE:', err.message); process.exit(1); });
