const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const giftSubscriptionService = require('../services/giftSubscriptionService');
const { initializePayment } = require('../services/paymentGateway');
const logger = require('../utils/logger');

const GIFTABLE_TYPES = giftSubscriptionService.GIFTABLE_USER_TYPES;

// ── Public: giftable directory (no auth) ──────────────────────
exports.listGiftable = async (req, res, next) => {
  try {
    const { account_type, search, page, limit } = req.query;
    const result = await giftSubscriptionService.listGiftableUsers({
      accountType: GIFTABLE_TYPES.includes(account_type) ? account_type : null,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 24,
    });
    return res.json(success('Giftable users', result));
  } catch (err) { next(err); }
};

// ── Public: exact-match email lookup for donors ───────────────
exports.lookupByEmail = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json(error('email is required'));
    const user = await giftSubscriptionService.findGiftableByEmail(email);
    // null response is intentionally indistinguishable from "not giftable"
    return res.json(success('Lookup complete', { user }));
  } catch (err) { next(err); }
};

// ── Public: initiate a gift batch payment ─────────────────────
exports.initiateGift = async (req, res, next) => {
  try {
    const {
      recipient_emails = [],
      recipient_ids = [],
      plan_name,
      billing_cycle = 'monthly',
      is_anonymous = false,
      donor_name,
      donor_email,
      donor_title,
      donor_company,
      donor_role,
      donor_note,
    } = req.body;

    const hasEmails = Array.isArray(recipient_emails) && recipient_emails.length > 0;
    const hasIds = Array.isArray(recipient_ids) && recipient_ids.length > 0;
    if (!hasEmails && !hasIds) {
      return res.status(400).json(error('At least one recipient is required'));
    }
    const recipientCount = (hasEmails ? recipient_emails.length : 0) + (hasIds ? recipient_ids.length : 0);
    if (recipientCount > 100) {
      return res.status(400).json(error('A single gift is limited to 100 recipients'));
    }
    if (!plan_name || !['basic', 'student', 'pro'].includes(plan_name)) {
      return res.status(400).json(error('Gifting is available for Starter (basic/student) and Pro plans'));
    }
    if (!['monthly', 'annual'].includes(billing_cycle)) {
      return res.status(400).json(error('billing_cycle must be monthly or annual'));
    }

    // Donor identity: either anonymous, or a valid email is required
    const anonymous = !!is_anonymous;
    if (!anonymous && !donor_email) {
      return res.status(400).json(error('donor_email is required unless the gift is anonymous'));
    }
    if (!anonymous && donor_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(donor_email))) {
      return res.status(400).json(error('A valid donor_email is required'));
    }

    const plan = await resolvePlan(plan_name);
    if (!plan || !(Number(plan.price_monthly) > 0)) {
      return res.status(400).json(error('Invalid plan for gifting'));
    }

    // Resolve + validate every recipient against the giftable eligibility rules.
    // Directory selections arrive as user IDs (cards carry masked emails only);
    // email pastes arrive as full addresses. Both resolve server-side.
    const resolved = [];
    const seenEmails = new Set();

    if (hasIds) {
      const found = await giftSubscriptionService.resolveGiftableByIds(recipient_ids);
      const byId = new Map(found.map((u) => [u.id, u]));
      for (const id of recipient_ids) {
        const user = byId.get(id);
        if (!user) {
          return res.status(400).json(error('One or more selected members are no longer available for gifting. Please refresh and try again.'));
        }
        if (seenEmails.has(user.email)) continue;
        seenEmails.add(user.email);
        resolved.push({ email: user.email, name: user.name, userId: user.id });
      }
    }

    for (const rawEmail of hasEmails ? recipient_emails : []) {
      const email = String(rawEmail || '').trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      const user = await giftSubscriptionService.findGiftableByEmail(email);
      if (!user) {
        return res.status(400).json(error(`Recipient is not available for gifting: ${email}`));
      }
      seenEmails.add(email);
      resolved.push({ email, name: user.name || null, userId: user.id });
    }

    if (resolved.length === 0) {
      return res.status(400).json(error('At least one valid giftable recipient is required'));
    }

    const donor = {
      donor_user_id: req.user?.id || null, // guests have no user
      is_anonymous: anonymous,
      donor_name,
      donor_email: anonymous ? null : donor_email,
      donor_title,
      donor_company,
      donor_role,
      donor_note,
    };

    const batch = await giftSubscriptionService.createGiftBatch({
      donor,
      plan,
      billingCycle: billing_cycle,
      recipients: resolved,
    });

    // 100%-discount promos don't apply to gifting; amounts are always > 0 here.
    let payment;
    try {
      payment = await initializePayment({
        email: donor.donor_email || 'donors@qs.solnuv.com',
        amountNGN: Number(batch.amount_ngn),
        country: 'NG',
        metadata: {
          product_type: 'gift_batch',
          gift_batch_id: batch.id,
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle,
          donor_email: donor.donor_email,
          donor_name: donor.donor_name,
          is_anonymous: anonymous,
          custom_fields: [
            { display_name: 'Gift type', variable_name: 'gift', value: `Batch of ${batch.recipient_count}` },
            { display_name: 'Plan', variable_name: 'plan', value: plan.name },
            { display_name: 'Billing', variable_name: 'billing', value: billing_cycle },
          ],
        },
        callbackUrl: `${process.env.FRONTEND_URL}/gifting?status=return`,
        txPrefix: 'gift',
      });
    } catch (payError) {
      const providerMsg = payError?.response?.data?.message || payError?.message;
      logger.error('Gift payment initialization failed', { batchId: batch.id, error: providerMsg });
      return res.status(400).json(error(`Payment initialization failed: ${providerMsg}`));
    }

    // Persist the reference so the browser-return verify path can find the batch
    await supabase.from('gift_batches')
      .update({ payment_reference: payment.reference })
      .eq('id', batch.id);

    return res.json(success('Gift payment initiated', {
      batch_id: batch.id,
      reference: payment.reference,
      authorization_url: payment.authorization_url,
      amount: batch.amount_ngn,
      recipient_count: batch.recipient_count,
      plan_name: plan.name,
      billing_cycle,
    }));
  } catch (err) { next(err); }
};

// ── Public: browser-return confirmation (verify + finalize) ───
exports.confirmGift = async (req, res, next) => {
  try {
    const rawRef = String(req.query?.reference || req.body?.reference || '');
    const reference = rawRef.split(',')[0].trim();
    if (!reference) return res.status(400).json(error('reference is required'));

    const batch = await giftSubscriptionService.getPendingBatchByReference(reference);
    if (!batch) return res.status(404).json(error('Gift payment not found'));

    if (batch.payment_status === 'paid') {
      return res.json(success('Gift already processed', { batch_id: batch.id, already_processed: true }));
    }

    const { flutterwaveVerifyByReference } = require('../services/paymentGateway');
    let verification;
    try {
      verification = await flutterwaveVerifyByReference(reference);
    } catch (err) {
      return res.status(400).json(error('Payment not found. The transaction may not have been completed.'));
    }
    if (!verification.success) {
      return res.status(400).json(error('Payment not successful'));
    }

    const result = await giftSubscriptionService.finalizeGiftBatch({
      batchId: batch.id,
      successful: true,
      reference,
      amountPaid: verification.amount,
      flwTransactionId: verification.flw_transaction_id,
    });

    return res.json(success('Gift payment confirmed', {
      batch_id: batch.id,
      activated: result.activated,
      failed: result.failed,
    }));
  } catch (err) { next(err); }
};

// ── Admin: gifting analytics ──────────────────────────────────
exports.adminGiftAnalytics = async (req, res, next) => {
  try {
    const analytics = await giftSubscriptionService.getGiftAnalytics();
    return res.json(success('Gifting analytics', analytics));
  } catch (err) { next(err); }
};

// ── Helpers ───────────────────────────────────────────────────
async function resolvePlan(planName) {
  const aliases = planName === 'student' ? ['basic', 'student'] : [planName];
  const { data: plans, error: planErr } = await supabase
    .from('subscription_plans')
    .select('*')
    .in('name', aliases)
    .eq('is_active', true);
  if (planErr) throw planErr;
  if (!plans || plans.length === 0) return null;
  return plans.find((p) => p.name === planName)
    || plans.find((p) => p.name === 'basic')
    || plans.find((p) => p.name === 'student')
    || plans[0];
}


