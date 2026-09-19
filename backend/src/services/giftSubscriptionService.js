/**
 * Gift Subscription Service (V1.20)
 *
 * Batch + recipients model (see docs/adr/0002-gift-subscriptions-batch-model.md):
 *  - One donor checkout = one gift_batches row = one Flutterwave payment
 *  - One gift_recipients row per beneficiary, activated independently
 *  - Giftable directory is privacy-redacted server-side; raw emails never listed
 *
 * Eligibility (giftable):
 *  user_type IN ('student','professional')
 *  AND account_status = 'active'
 *  AND is_verified = true
 *  AND NOT (subscription_status = 'active' AND plan is paid)
 *
 * Finalization is idempotent: unique payment_reference + per-recipient activated_at guard.
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const emailService = require('./emailService');

const GIFTABLE_USER_TYPES = ['student', 'professional'];
const BILLING_CYCLES = ['monthly', 'annual'];

// ════════════════════════════════════════════════════════════════
//  REDACTION (security-critical: never bypass in public endpoints)
// ════════════════════════════════════════════════════════════════

/**
 * Redact an email for public display: "emmanuel.n@domain.co" → "em***@domain.co".
 * Keeps first 2 chars of the local part (1 if it's 1 char). Returns null for
 * anything that isn't a plausible email — never guess.
 */
function redactEmail(email) {
  const value = String(email || '').trim();
  const match = value.match(/^([^@]{1,})@([^@]{1,})$/);
  if (!match) return null;
  const [, local, domain] = match;
  if (!local || !domain) return null;
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

/**
 * Redact a display name: "Emmanuel Nwosu" → "Emmanuel N."
 * Single-word names pass through unchanged; null/blank → "Anonymous".
 */
function redactName(name) {
  const value = String(name || '').trim();
  if (!value) return 'Anonymous';
  const parts = value.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

// ════════════════════════════════════════════════════════════════
//  GIFTABLE DIRECTORY
// ════════════════════════════════════════════════════════════════

/**
 * Build the canonical "giftable" filter chain.
 * Exported for tests: the eligibility contract lives here and nowhere else.
 */
function applyGiftableFilters(query) {
  return query
    .in('user_type', GIFTABLE_USER_TYPES)
    .eq('account_status', 'active')
    .eq('is_verified', true)
    .neq('subscription_status', 'active');
}

function toDirectoryRow(user) {
  return {
    id: user.id,
    display_name: redactName(user.name),
    email_masked: redactEmail(user.email),
    user_type: user.user_type,
    university_name: user.user_type === 'student' ? (user.university_name || null) : null,
    company_name: user.user_type === 'professional' ? (user.company_name || null) : null,
    country: user.country || null,
    created_at: user.created_at,
  };
}

/**
 * Public directory of giftable users. Never returns raw emails or full names.
 * @param {object} opts - { accountType: 'student'|'professional'|null, search, page, limit }
 */
async function listGiftableUsers(opts = {}) {
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 24));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('users')
    .select('id, name, email, user_type, university_name, company_name, country, created_at', { count: 'exact' })
    .eq('onboarding_completed', true);

  query = applyGiftableFilters(query);

  if (opts.accountType && GIFTABLE_USER_TYPES.includes(opts.accountType)) {
    query = query.eq('user_type', opts.accountType);
  }

  // Optional name-prefix search on the redacted display name. Full-email search
  // goes through findGiftableByEmail instead (exact match only).
  if (opts.search && String(opts.search).trim().length >= 2) {
    query = query.ilike('name', `%${String(opts.search).trim()}%`);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    logger.error('listGiftableUsers query failed', { error: error.message });
    return { users: [], total: 0, page, limit };
  }

  return {
    users: (data || []).map(toDirectoryRow),
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Exact-match lookup by full email (donor pastes an address).
 * Eligibility-checked; null when no match — deliberately does NOT
 * distinguish "not giftable" from "doesn't exist".
 */
async function findGiftableByEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return null;

  let query = supabase
    .from('users')
    .select('id, name, email, user_type, university_name, company_name, country, created_at')
    .eq('email', value)
    .eq('onboarding_completed', true)
    .limit(1);

  query = applyGiftableFilters(query);

  const { data, error } = await query;
  if (error) {
    logger.error('findGiftableByEmail query failed', { error: error.message });
    return null;
  }
  const user = (data || [])[0];
  return user ? toDirectoryRow(user) : null;
}

// ════════════════════════════════════════════════════════════════
//  BATCH CREATION
// ════════════════════════════════════════════════════════════════

/**
 * Internal (non-redacted) lookup by user IDs - used by checkout to resolve
 * directory-card selections. Raw rows must never be returned to the client.
 */
async function resolveGiftableByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  let query = supabase
    .from('users')
    .select('id, name, email, user_type, university_name, company_name, country, created_at')
    .in('id', uniqueIds)
    .eq('onboarding_completed', true);

  query = applyGiftableFilters(query);

  const { data, error } = await query;
  if (error) {
    logger.error('resolveGiftableByIds query failed', { error: error.message });
  }
  return data || [];
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function donorColumns(donor = {}) {
  const anonymous = !!donor.is_anonymous;
  if (anonymous) {
    return {
      donor_user_id: donor.donor_user_id || null,
      donor_name: null,
      donor_email: null,
      donor_title: null,
      donor_company: null,
      donor_role: null,
      is_anonymous: true,
      donor_note: donor.donor_note ? String(donor.donor_note).slice(0, 2000) : null,
    };
  }
  return {
    donor_user_id: donor.donor_user_id || null,
    donor_name: donor.donor_name ? String(donor.donor_name).trim().slice(0, 255) : null,
    donor_email: donor.donor_email ? String(donor.donor_email).trim().toLowerCase() : null,
    donor_title: donor.donor_title ? String(donor.donor_title).trim().slice(0, 255) : null,
    donor_company: donor.donor_company ? String(donor.donor_company).trim().slice(0, 255) : null,
    donor_role: donor.donor_role ? String(donor.donor_role).trim().slice(0, 255) : null,
    is_anonymous: false,
    donor_note: donor.donor_note ? String(donor.donor_note).slice(0, 2000) : null,
  };
}

/**
 * Create a pending gift batch + one gift_recipients row per beneficiary.
 * Amount = recipient count × plan price for the chosen cycle.
 * @param {object} p - { donor, plan, billingCycle, recipients: [{email, name, userId}] }
 * @returns {object} batch row as stored
 */
async function createGiftBatch({ donor = {}, plan, billingCycle = 'monthly', recipients = [] }) {
  if (!plan || !plan.name) throw new Error('A valid plan is required');
  if (!BILLING_CYCLES.includes(billingCycle)) throw new Error('billing_cycle must be monthly or annual');
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }

  // Dedupe (case-insensitive on email)
  const seen = new Set();
  const unique = [];
  for (const r of recipients) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) throw new Error('Duplicate recipient in gift batch');
    seen.add(email);
    unique.push({
      email,
      name: r.name ? String(r.name).trim().slice(0, 255) : null,
      user_id: r.userId || r.user_id || null,
    });
  }
  if (unique.length === 0) throw new Error('At least one recipient is required');

  const unitPrice = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
  const amount = roundMoney(Number(unitPrice) * unique.length);
  if (!(amount > 0)) throw new Error('Gift amount must be greater than zero');

  const payload = {
    ...donorColumns(donor),
    plan_name: plan.name,
    billing_cycle: billingCycle,
    amount_ngn: amount,
    currency: 'NGN',
    payment_status: 'pending',
    recipient_count: unique.length,
  };

  const { data: batch, error } = await supabase
    .from('gift_batches')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Failed to create gift batch: ${error.message}`);

  const recipientRows = unique.map((r) => ({
    batch_id: batch.id,
    user_id: r.user_id,
    recipient_email: r.email,
    recipient_name: r.name,
    plan_name: plan.name,
    billing_cycle: billingCycle,
    gift_message: payload.donor_note,
    status: 'pending',
  }));

  const { error: recError } = await supabase
    .from('gift_recipients')
    .insert(recipientRows);
  if (recError) throw new Error(`Failed to create gift recipients: ${recError.message}`);

  logger.info('Gift batch created', { batchId: batch.id, recipients: unique.length, amount, plan: plan.name, billingCycle });
  return batch;
}

// ════════════════════════════════════════════════════════════════
//  FINALIZATION (called from webhook + verify — must be idempotent)
// ════════════════════════════════════════════════════════════════

/**
 * Finalize a batch payment. Idempotent:
 *  - payment status flips pending → paid only once
 *  - per-recipient activation guarded by status='pending' update filter
 * @param {object} p - { batchId, successful, reference, amountPaid, flwTransactionId }
 */
async function finalizeGiftBatch({ batchId, successful, reference = null, amountPaid = null, flwTransactionId = null }) {
  if (!batchId) return { activated: 0, failed: 0, skipped: 'missing_batch_id' };

  const { data: batch } = await supabase
    .from('gift_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) return { activated: 0, failed: 0, skipped: 'batch_not_found' };
  if (!successful) {
    await supabase.from('gift_batches')
      .update({ payment_status: 'failed', payment_reference: reference })
      .eq('id', batchId)
      .eq('payment_status', 'pending');
    return { activated: 0, failed: 0, skipped: 'payment_unsuccessful' };
  }

  // Mark paid (guarded — no-op if already paid)
  const { data: paidRows } = await supabase.from('gift_batches')
    .update({
      payment_status: 'paid',
      payment_reference: reference,
      amount_paid: roundMoney(amountPaid ?? batch.amount_ngn),
      flw_transaction_id: flwTransactionId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('payment_status', 'pending')
    .select('id');

  const firstTime = Array.isArray(paidRows) && paidRows.length > 0;

  const { data: recipients } = await supabase
    .from('gift_recipients')
    .select('*')
    .eq('batch_id', batchId);

  let activated = 0;
  let failed = 0;

  for (const recipient of recipients || []) {
    if (recipient.status === 'activated') { activated += 1; continue; }
    if (recipient.status !== 'pending') continue;

    const result = await activateGiftedSubscription(recipient, batch);
    if (result.ok) {
      activated += 1;
    } else {
      failed += 1;
      await supabase.from('gift_recipients')
        .update({ status: 'failed', failure_reason: String(result.error).slice(0, 500) })
        .eq('id', recipient.id)
        .eq('status', 'pending');
    }
  }

  await supabase.from('gift_batches')
    .update({ activated_count: activated, failed_count: failed })
    .eq('id', batchId);

  // Donor receipt — only the first time this batch transitions to paid
  if (firstTime && batch.donor_email && !batch.is_anonymous) {
    try {
      const finalRecipients = await supabase
        .from('gift_recipients')
        .select('*')
        .eq('batch_id', batchId);
      await emailService.sendGiftDonorConfirmation(batch, (finalRecipients.data || []));
    } catch (err) {
      logger.warn('Gift donor confirmation email failed', { batchId, error: err.message });
    }
  }

  logger.info('Gift batch finalized', { batchId, activated, failed, firstTime });
  return { activated, failed, firstTime };
}

/**
 * Activate one gifted recipient's subscription + send the gifting email.
 * Uses the same activation primitive as self-serve subscriptions
 * (subscriptionManagementService) so lifecycles stay consistent.
 */
async function activateGiftedSubscription(recipient, batch) {
  try {
    const subscriptionManagementService = require('./subscriptionManagementService');

    // Resolve user (may have been resolved at checkout; re-check in case of deletion)
    let userId = recipient.user_id;
    if (!userId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', recipient.recipient_email)
        .maybeSingle();
      userId = user?.id || null;
    }
    if (!userId) return { ok: false, error: 'Recipient account not found' };

    const { expiresAt } = await subscriptionManagementService.activateSubscription(
      userId,
      recipient.plan_name,
      recipient.billing_cycle,
      { reference: batch.payment_reference, triggeredBy: 'gift', giftBatchId: batch.id }
    );

    // Guarded update → idempotent under webhook + verify double-delivery
    const { data: activatedRows } = await supabase.from('gift_recipients')
      .update({ status: 'activated', activated_at: new Date().toISOString(), expires_at: expiresAt })
      .eq('id', recipient.id)
      .eq('status', 'pending')
      .select('id');

    if (!Array.isArray(activatedRows) || activatedRows.length === 0) {
      return { ok: true, duplicate: true };
    }

    // Gifting email — donor info when available, else anonymous
    try {
      const { data: beneficiary } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userId)
        .maybeSingle();
      if (beneficiary) {
        await emailService.sendGiftNotification(beneficiary, batch);
      }
    } catch (err) {
      logger.warn('Gift notification email failed', { recipientId: recipient.id, error: err.message });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Browser-return verify path: find a pending batch by its Flutterwave reference.
 */
async function getPendingBatchByReference(reference) {
  if (!reference) return null;
  const { data } = await supabase
    .from('gift_batches')
    .select('id, payment_status')
    .eq('payment_reference', reference)
    .maybeSingle();
  return data || null;
}

// ════════════════════════════════════════════════════════════════
//  ADMIN ANALYTICS
// ════════════════════════════════════════════════════════════════

/**
 * Aggregate gifting analytics for the admin dashboard.
 * Never throws — stats legs resolve independently with safe defaults.
 */
async function getGiftAnalytics() {
  const empty = {
    totals: { batches: 0, recipients_gifted: 0, revenue_ngn: 0, anonymous_share: 0 },
    by_plan: [],
    by_user_type: [],
    monthly_trend: [],
    top_gifted_users: [],
    recent_batches: [],
  };

  try {
    const [
      batchStats,
      recipientStats,
      planRows,
      userTypeRows,
      trendRows,
      topUsers,
      recentBatches,
    ] = await Promise.all([
      supabase.from('gift_batches').select('id, amount_paid, amount_ngn, is_anonymous, payment_status, created_at').eq('payment_status', 'paid'),
      supabase.from('gift_recipients').select('id, status').eq('status', 'activated'),
      supabase.from('gift_batches').select('plan_name, amount_paid').eq('payment_status', 'paid'),
      supabase.from('gift_recipients').select('plan_name, users(user_type)').eq('status', 'activated').not('user_id', 'is', null),
      supabase.from('gift_batches').select('amount_paid, paid_at, created_at').eq('payment_status', 'paid').order('created_at', { ascending: true }),
      supabase.from('gift_recipients').select('recipient_email, recipient_name, user_id').eq('status', 'activated').limit(500),
      supabase.from('gift_batches').select('*').order('created_at', { ascending: false }).limit(20),
    ]).catch(() => [null, null, null, null, null, null, null]);

    const batches = batchStats?.data || [];
    const recipients = recipientStats?.data || [];

    const revenue = batches.reduce((sum, b) => sum + (Number(b.amount_paid ?? b.amount_ngn) || 0), 0);
    const anonymousCount = batches.filter((b) => b.is_anonymous).length;

    // Aggregate helpers
    const groupCount = (rows, key) => {
      const map = {};
      for (const row of rows) {
        const k = row[key] || 'unknown';
        map[k] = (map[k] || 0) + 1;
      }
      return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    };

    const planMap = {};
    for (const row of planRows?.data || []) {
      const k = row.plan_name || 'unknown';
      planMap[k] = (planMap[k] || 0) + (Number(row.amount_paid) || 0);
    }

    // Monthly trend (last 12 months)
    const trendMap = {};
    for (const row of trendRows?.data || []) {
      const d = new Date(row.paid_at || row.created_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      trendMap[key] = (trendMap[key] || 0) + (Number(row.amount_paid) || 0);
    }
    const monthly_trend = Object.entries(trendMap)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([month, revenue]) => ({ month, revenue }));

    // Top gifted users (by gift count)
    const userMap = {};
    for (const row of topUsers?.data || []) {
      const key = row.recipient_email;
      if (!userMap[key]) userMap[key] = { name: redactName(row.recipient_name), email_masked: redactEmail(row.recipient_email), gifts: 0 };
      userMap[key].gifts += 1;
    }
    const top_gifted_users = Object.values(userMap)
      .sort((a, b) => b.gifts - a.gifts)
      .slice(0, 10);

    return {
      totals: {
        batches: batches.length,
        recipients_gifted: recipients.length,
        revenue_ngn: roundMoney(revenue),
        anonymous_share: batches.length ? Math.round((anonymousCount / batches.length) * 100) : 0,
      },
      by_plan: Object.entries(planMap).map(([name, revenue]) => ({ name, revenue })),
      by_user_type: groupCount(
        (userTypeRows?.data || []).map((r) => ({ user_type: r.users?.user_type || 'unknown' })),
        'user_type'
      ),
      monthly_trend,
      top_gifted_users,
      recent_batches: (recentBatches?.data || []).map((b) => ({
        id: b.id,
        donor_display: b.is_anonymous ? 'Anonymous' : redactName(b.donor_name || 'Anonymous'),
        plan_name: b.plan_name,
        billing_cycle: b.billing_cycle,
        amount_ngn: b.amount_paid ?? b.amount_ngn,
        recipient_count: b.recipient_count,
        activated_count: b.activated_count,
        payment_status: b.payment_status,
        created_at: b.created_at,
      })),
    };
  } catch (err) {
    logger.error('getGiftAnalytics failed — returning safe defaults', { error: err.message });
    return empty;
  }
}

module.exports = {
  GIFTABLE_USER_TYPES,
  BILLING_CYCLES,
  redactEmail,
  redactName,
  applyGiftableFilters,
  listGiftableUsers,
  findGiftableByEmail,
  resolveGiftableByIds,
  createGiftBatch,
  finalizeGiftBatch,
  getPendingBatchByReference,
  getGiftAnalytics,
};
