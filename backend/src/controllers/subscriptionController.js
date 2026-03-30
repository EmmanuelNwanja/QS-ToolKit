const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const emailService = require('../services/emailService');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

const PLAN_ALIASES = {
  free: ['free'],
  basic: ['basic', 'student'],
  student: ['student', 'basic'],
  pro: ['pro'],
  enterprise: ['enterprise']
};

function getPlanAliases(name) {
  return PLAN_ALIASES[name] || [name];
}

function isPlanAllowedByPromo(promo, requestedPlan) {
  const applicablePlans = Array.isArray(promo?.applicable_plans) ? promo.applicable_plans : [];
  return getPlanAliases(requestedPlan).some((alias) => applicablePlans.includes(alias));
}

async function resolveSubscriptionPlanByName(planName) {
  const aliases = getPlanAliases(planName);
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

async function resolveSubscriptionPlanByPaystackCode(planCode) {
  if (!planCode) return null;

  const { data: plans, error: planErr } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true);

  if (planErr) throw planErr;

  return (plans || []).find((plan) => (
    plan.paystack_plan_code === planCode || plan.paystack_plan_code_annual === planCode
  )) || null;
}

function getPaystackPlanCode(plan, billingCycle) {
  if (!plan) return null;
  const code = billingCycle === 'annual'
    ? plan.paystack_plan_code_annual
    : plan.paystack_plan_code;
  const normalized = String(code || '').trim();
  return normalized || null;
}

function resolveBillingCycleFromPlanCode(plan, planCode, fallback = 'monthly') {
  if (!planCode || !plan) return fallback;
  if (plan.paystack_plan_code_annual === planCode) return 'annual';
  if (plan.paystack_plan_code === planCode) return 'monthly';
  return fallback;
}

async function initializeRecurringTransaction({ email, amountKobo, paystackPlanCode, metadata, callbackUrl }) {
  return axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
    email,
    amount: amountKobo,
    currency: 'NGN',
    plan: paystackPlanCode,
    metadata,
    callback_url: callbackUrl
  }, { headers: paystackHeaders() });
}

// ── Get all plans ─────────────────────────────────────────────
exports.getPlans = async (req, res, next) => {
  try {
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly');
    return res.json(success('Plans', { plans }));
  } catch (err) { next(err); }
};

// ── Validate promo code ───────────────────────────────────────
exports.validatePromo = async (req, res, next) => {
  try {
    const { code, plan_name } = req.body;
    if (!code || !plan_name) return res.status(400).json(error('code and plan_name required'));
    if (!['basic', 'student', 'pro'].includes(plan_name))
      return res.status(400).json(error('Promo codes are only valid for Basic and Pro plans'));

    const { data: promo } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('is_active', true)
      .ilike('code', code.trim())
      .single();

    if (!promo) return res.status(404).json(error('Invalid or unrecognised promo code'));
    if (promo.expires_at && new Date(promo.expires_at) < new Date())
      return res.status(410).json(error('This promo code has expired'));
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses)
      return res.status(410).json(error('This promo code has reached its usage limit'));
    if (!isPlanAllowedByPromo(promo, plan_name))
      return res.status(400).json(error(`This promo code is not valid for the ${plan_name} plan`));

    const { data: alreadyUsed } = await supabase
      .from('promo_code_uses')
      .select('id').eq('promo_id', promo.id).eq('user_id', req.user.id).single();
    if (alreadyUsed) return res.status(409).json(error('You have already used this promo code'));

    return res.json(success('Promo code valid', {
      code: promo.code,
      description: promo.description,
      discount_percent: promo.discount_percent,
      promo_id: promo.id
    }));
  } catch (err) { next(err); }
};

// ── Initiate payment (own subscription) ──────────────────────
exports.initiate = async (req, res, next) => {
  try {
    const { plan_name, billing_cycle = 'monthly', promo_code } = req.body;
    if (!['monthly', 'annual'].includes(billing_cycle))
      return res.status(400).json(error('billing_cycle must be monthly or annual'));

    const plan = await resolveSubscriptionPlanByName(plan_name);
    if (!plan || plan.price_monthly === 0)
      return res.status(400).json(error('Invalid plan for payment'));

    const { data: user } = await supabase
      .from('users').select('email, name').eq('id', req.user.id).single();
    if (!user?.email) {
      return res.status(400).json(error('User email is required to initiate payment'));
    }

    const paystackPlanCode = getPaystackPlanCode(plan, billing_cycle);
    if (!paystackPlanCode) {
      return res.status(400).json(error(`Paystack plan code is not configured for the ${plan.name} ${billing_cycle} plan`));
    }

    let basePrice = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    let discountApplied = 0;
    let promoId = null;

    if (promo_code && ['basic', 'student', 'pro'].includes(plan_name)) {
      const { data: promo } = await supabase
        .from('promo_codes').select('*').eq('is_active', true).ilike('code', promo_code.trim()).single();
      if (promo && isPlanAllowedByPromo(promo, plan_name)) {
        const expired = promo.expires_at && new Date(promo.expires_at) < new Date();
        const maxed   = promo.max_uses !== null && promo.uses_count >= promo.max_uses;
        const { data: used } = await supabase.from('promo_code_uses')
          .select('id').eq('promo_id', promo.id).eq('user_id', req.user.id).single();
        if (!expired && !maxed && !used) {
          discountApplied = (basePrice * promo.discount_percent) / 100;
          basePrice = basePrice - discountApplied;
          promoId = promo.id;
        }
      }
    }

    basePrice = Math.max(0, Number(basePrice) || 0);
    const amountKobo = Math.round(basePrice * 100);

    // 100% promo discounts should activate directly without external payment.
    if (amountKobo === 0) {
      const expiresAt = await activateSubscription(req.user.id, plan.id, billing_cycle);

      if (promoId) {
        await supabase.from('promo_code_uses').upsert(
          { promo_id: promoId, user_id: req.user.id, plan_name: plan.name },
          { onConflict: 'promo_id,user_id', ignoreDuplicates: true }
        );
        await supabase.rpc('increment_promo_uses', { p_promo_id: promoId });
      }

      await emailService.sendSubscriptionConfirmation(user, billing_cycle, expiresAt);

      return res.json(success('Subscription activated with promo code', {
        activated: true,
        authorization_url: null,
        reference: null,
        amount: 0,
        discount_applied: discountApplied,
        billing_cycle,
        expires_at: expiresAt.toISOString()
      }));
    }

    let paystackRes;
    try {
      paystackRes = await initializeRecurringTransaction({
        email: user.email,
        amountKobo,
        paystackPlanCode,
        metadata: {
          user_id: req.user.id,
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle,
          paystack_plan_code: paystackPlanCode,
          promo_id: promoId,
          discount_applied: discountApplied,
          is_philanthropist: false,
          custom_fields: [
            { display_name: 'Plan',    variable_name: 'plan',    value: plan.name },
            { display_name: 'Billing', variable_name: 'billing', value: billing_cycle }
          ]
        },
        callbackUrl: `${process.env.FRONTEND_URL}/subscription`
      });
    } catch (paystackError) {
      const providerMsg = paystackError?.response?.data?.message || paystackError.message;
      return res.status(400).json(error(`Payment initialization failed: ${providerMsg}`));
    }

    return res.json(success('Payment initiated', {
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference,
      amount: basePrice,
      discount_applied: discountApplied,
      billing_cycle
    }));
  } catch (err) { next(err); }
};

// ── Initiate philanthropist payment ──────────────────────────
exports.initiatePhilanthropist = async (req, res, next) => {
  try {
    const { beneficiary_email, plan_name, billing_cycle = 'monthly',
            donor_name, donor_email, message_to_beneficiary, promo_code } = req.body;

    if (!beneficiary_email || !plan_name || !donor_email)
      return res.status(400).json(error('beneficiary_email, plan_name and donor_email are required'));
    if (!['basic', 'student', 'pro'].includes(plan_name))
      return res.status(400).json(error('Philanthropist grants are only available for Basic and Pro plans'));

    const plan = await resolveSubscriptionPlanByName(plan_name);
    if (!plan) return res.status(400).json(error('Invalid plan'));

    const paystackPlanCode = getPaystackPlanCode(plan, billing_cycle);
    if (!paystackPlanCode) {
      return res.status(400).json(error(`Paystack plan code is not configured for the ${plan.name} ${billing_cycle} plan`));
    }

    let basePrice = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    let discountApplied = 0;
    let promoId = null;

    if (promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes').select('*').eq('is_active', true).ilike('code', promo_code.trim()).single();
      if (promo && isPlanAllowedByPromo(promo, plan_name)) {
        const expired = promo.expires_at && new Date(promo.expires_at) < new Date();
        const maxed   = promo.max_uses !== null && promo.uses_count >= promo.max_uses;
        if (!expired && !maxed) {
          discountApplied = (basePrice * promo.discount_percent) / 100;
          basePrice = basePrice - discountApplied;
          promoId = promo.id;
        }
      }
    }

    const { data: grant } = await supabase
      .from('philanthropist_grants')
      .insert({ donor_name, donor_email, beneficiary_email, plan_name,
                billing_cycle, payment_status: 'pending', grant_status: 'pending', message_to_beneficiary })
      .select().single();

    basePrice = Math.max(0, Number(basePrice) || 0);
    const amountKobo = Math.round(basePrice * 100);

    // 100% promo discounts should finalize the grant immediately.
    if (amountKobo === 0) {
      await supabase.from('philanthropist_grants').update({
        payment_status: 'paid',
        amount_paid: 0,
        paystack_reference: `PROMO-${grant.id}`
      }).eq('id', grant.id);

      if (promoId) {
        await supabase.rpc('increment_promo_uses', { p_promo_id: promoId });
      }

      const { data: beneficiary } = await supabase.from('users')
        .select('id, email, name').eq('email', beneficiary_email).single();

      if (beneficiary) {
        const expiresAt = await activateSubscription(beneficiary.id, plan.id, billing_cycle);
        await supabase.from('philanthropist_grants').update({
          beneficiary_user_id: beneficiary.id,
          grant_status: 'active',
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }).eq('id', grant.id);
        await emailService.sendPhilanthropistGiftNotification?.(beneficiary, {
          donor_name,
          donor_email,
          beneficiary_email,
          plan_name,
          billing_cycle
        });
      } else {
        await emailService.sendPhilanthropistDonorConfirmation?.({
          donor_name,
          donor_email,
          beneficiary_email,
          plan_name,
          billing_cycle
        });
      }

      return res.json(success('Philanthropist grant activated with promo code', {
        activated: true,
        authorization_url: null,
        reference: null,
        amount: 0,
        discount_applied: discountApplied,
        grant_id: grant.id
      }));
    }

    let paystackRes;
    try {
      paystackRes = await initializeRecurringTransaction({
        email: donor_email,
        amountKobo,
        paystackPlanCode,
        metadata: {
          is_philanthropist: true,
          grant_id: grant.id,
          beneficiary_email,
          plan_id: plan.id,
          plan_name,
          billing_cycle,
          paystack_plan_code: paystackPlanCode,
          promo_id: promoId,
          discount_applied: discountApplied,
          donor_name,
          donor_email,
          custom_fields: [
            { display_name: 'Gift for', variable_name: 'for',     value: beneficiary_email },
            { display_name: 'Plan',     variable_name: 'plan',    value: plan_name },
            { display_name: 'Billing',  variable_name: 'billing', value: billing_cycle }
          ]
        },
        callbackUrl: `${process.env.FRONTEND_URL}/subscription`
      });
    } catch (paystackError) {
      const providerMsg = paystackError?.response?.data?.message || paystackError.message;
      return res.status(400).json(error(`Payment initialization failed: ${providerMsg}`));
    }

    return res.json(success('Philanthropist payment initiated', {
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference,
      amount: basePrice,
      discount_applied: discountApplied,
      grant_id: grant.id
    }));
  } catch (err) { next(err); }
};

// ── Helpers ───────────────────────────────────────────────────
async function activateSubscription(userId, planId, billingCycle, options = {}) {
  const { extendFromCurrentExpiry = false } = options;
  const { data: currentUser } = await supabase
    .from('users')
    .select('subscription_expires_at')
    .eq('id', userId)
    .single();

  const now = new Date();
  const currentExpiry = currentUser?.subscription_expires_at
    ? new Date(currentUser.subscription_expires_at)
    : null;
  const baseDate = extendFromCurrentExpiry && currentExpiry && currentExpiry.getTime() > now.getTime()
    ? currentExpiry
    : now;
  const expiresAt = new Date(baseDate.getTime());

  billingCycle === 'annual'
    ? expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    : expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { error } = await supabase.from('users').update({
    plan_id: planId,
    subscription_status: 'active',
    subscription_expires_at: expiresAt.toISOString(),
    billing_cycle: billingCycle
  }).eq('id', userId);

  if (error) throw new Error(`Subscription activation failed: ${error.message}`);
  return expiresAt;
}

// ── Verify payment ────────────────────────────────────────────
exports.verify = async (req, res, next) => {
  try {
    const { reference } = req.query;
    const paystackRes = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: paystackHeaders() }
    );
    const txn = paystackRes.data.data;
    if (txn.status !== 'success') return res.status(400).json(error('Payment not successful'));

    const meta = txn.metadata;

    if (meta.is_philanthropist) {
      await supabase.from('philanthropist_grants')
        .update({ payment_status: 'paid', paystack_reference: reference, amount_paid: txn.amount / 100 })
        .eq('id', meta.grant_id);

      const { data: beneficiary } = await supabase.from('users')
        .select('id, email, name').eq('email', meta.beneficiary_email).single();

      if (beneficiary) {
        const expiresAt = await activateSubscription(beneficiary.id, meta.plan_id, meta.billing_cycle);
        await supabase.from('philanthropist_grants').update({
          beneficiary_user_id: beneficiary.id,
          grant_status: 'active',
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }).eq('id', meta.grant_id);
        await emailService.sendPhilanthropistGiftNotification?.(beneficiary, meta);
      } else {
        await emailService.sendPhilanthropistDonorConfirmation?.(meta);
      }
    } else {
      const alreadyProcessed = await hasBillingTransactionReference(reference);
      if (alreadyProcessed) {
        return res.json(success('Subscription already processed', {
          plan: meta.plan_name,
          billing_cycle: meta.billing_cycle || 'monthly'
        }));
      }

      const expiresAt = await activateSubscription(
        meta.user_id,
        meta.plan_id,
        meta.billing_cycle || 'monthly',
        { extendFromCurrentExpiry: !!(meta.is_renewal || meta.is_auto_renewal) }
      );
      await persistPaystackCustomerState(meta.user_id, txn);

      // Record billing transaction for audit and admin subscriptions view
      await recordBillingTransactionOnce({
        userId: meta.user_id,
        amount: txn.amount / 100,
        currency: txn.currency || 'NGN',
        reference,
        description: `${meta.plan_name} plan (${meta.billing_cycle || 'monthly'}) subscription`,
        metadata: {
          plan_id: meta.plan_id,
          plan_name: meta.plan_name,
          billing_cycle: meta.billing_cycle,
          paystack_plan_code: meta.paystack_plan_code || txn.plan?.plan_code || null
        }
      });

      if (meta.promo_id) {
        await supabase.from('promo_code_uses').upsert(
          { promo_id: meta.promo_id, user_id: meta.user_id, plan_name: meta.plan_name },
          { onConflict: 'promo_id,user_id', ignoreDuplicates: true }
        );
        await supabase.rpc('increment_promo_uses', { p_promo_id: meta.promo_id });
      }
      const { data: user } = await supabase.from('users')
        .select('email, name, subscription_plans(name)').eq('id', meta.user_id).single();
      await emailService.sendSubscriptionConfirmation(user, meta.billing_cycle, expiresAt);
    }

    return res.json(success('Subscription activated', {
      plan: meta.plan_name, billing_cycle: meta.billing_cycle || 'monthly'
    }));
  } catch (err) { next(err); }
};

// ── Paystack webhook ──────────────────────────────────────────
exports.webhook = async (req, res, next) => {
  try {
    const hash = require('crypto')
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature'])
      return res.status(401).send('Invalid signature');

    const { event, data } = req.body;
    if (event === 'charge.success') {
      const meta = data.metadata || {};
      if (!meta.is_philanthropist && meta.user_id && meta.plan_id) {
        if (await hasBillingTransactionReference(data.reference)) {
          return res.sendStatus(200);
        }

        await activateSubscription(
          meta.user_id,
          meta.plan_id,
          meta.billing_cycle || 'monthly',
          { extendFromCurrentExpiry: !!(meta.is_renewal || meta.is_auto_renewal) }
        );
        await persistPaystackCustomerState(meta.user_id, data);
        await recordBillingTransactionOnce({
          userId: meta.user_id,
          amount: (data.amount || 0) / 100,
          currency: data.currency || 'NGN',
          reference: data.reference,
          description: `${meta.plan_name} plan (${meta.billing_cycle || 'monthly'}) subscription`,
          metadata: {
            plan_id: meta.plan_id,
            plan_name: meta.plan_name,
            billing_cycle: meta.billing_cycle,
            paystack_plan_code: meta.paystack_plan_code || data.plan?.plan_code || null,
            source: 'charge.success'
          }
        });
        if (meta.promo_id) {
          await supabase.from('promo_code_uses').upsert(
            { promo_id: meta.promo_id, user_id: meta.user_id, plan_name: meta.plan_name },
            { onConflict: 'promo_id,user_id', ignoreDuplicates: true }
          );
        }
      }
    }
    if (event === 'subscription.create') {
      const resolved = await resolveUserAndPlanFromPaystackEvent(data);
      if (resolved?.user?.id) {
        await persistPaystackCustomerState(resolved.user.id, data);
      }
    }
    if (event === 'invoice.update' && isSuccessfulInvoiceEvent(data)) {
      const recurringReference = data.reference || data.invoice_code || null;
      if (recurringReference && await hasBillingTransactionReference(recurringReference)) {
        return res.sendStatus(200);
      }

      const resolved = await resolveUserAndPlanFromPaystackEvent(data);
      if (resolved?.user?.id && resolved?.plan?.id) {
        const billingCycle = resolved.billingCycle || resolved.user.billing_cycle || 'monthly';
        await activateSubscription(
          resolved.user.id,
          resolved.plan.id,
          billingCycle,
          { extendFromCurrentExpiry: true }
        );
        await persistPaystackCustomerState(resolved.user.id, data);
        await recordBillingTransactionOnce({
          userId: resolved.user.id,
          amount: (data.amount_paid ?? data.amount ?? 0) / 100,
          currency: data.currency || 'NGN',
          reference: data.reference || data.invoice_code || `${event}-${resolved.user.id}-${Date.now()}`,
          description: `${resolved.plan.name} plan (${billingCycle}) renewal`,
          metadata: {
            plan_id: resolved.plan.id,
            plan_name: resolved.plan.name,
            billing_cycle: billingCycle,
            paystack_plan_code: resolved.planCode,
            source: 'invoice.update'
          }
        });
      }
    }
    if (event === 'subscription.disable') {
      const email = data.customer?.email;
      if (email) await supabase.from('users').update({ subscription_status: 'inactive' }).eq('email', email);
    }
    return res.sendStatus(200);
  } catch (err) { next(err); }
};

// ── Get my subscription ───────────────────────────────────────
exports.mySubscription = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_expires_at, billing_cycle, auto_renew, email, subscription_plans(*)')
      .eq('id', req.user.id)
      .single();

    const { data: pendingGrant } = await supabase
      .from('philanthropist_grants')
      .select('*')
      .eq('beneficiary_email', user?.email)
      .eq('grant_status', 'pending')
      .maybeSingle();

    return res.json(success('Subscription info', {
      status:        user.subscription_status,
      plan:          user.subscription_plans,
      expires_at:    user.subscription_expires_at,
      billing_cycle: user.billing_cycle || 'monthly',
      auto_renew:    user.auto_renew !== false,
      pending_gift:  pendingGrant || null
    }));
  } catch (err) { next(err); }
};

// ── Cancel my subscription ───────────────────────────────────
exports.cancelMySubscription = async (req, res, next) => {
  try {
    const { error: dbError } = await supabase
      .from('users')
      .update({
        subscription_status: 'cancelled',
        auto_renew: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (dbError) throw new Error(dbError.message);
    return res.json(success('Subscription cancelled. Access remains until current expiry date.'));
  } catch (err) { next(err); }
};

// ── Toggle auto-renew ────────────────────────────────────────
exports.setAutoRenew = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json(error('enabled must be a boolean'));
    }

    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({ auto_renew: enabled, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('id, auto_renew')
      .single();

    if (dbError) throw new Error(dbError.message);
    return res.json(success(`Auto-renew ${enabled ? 'enabled' : 'disabled'}`, { auto_renew: updated.auto_renew }));
  } catch (err) { next(err); }
};

// ── Renew my subscription ────────────────────────────────────
exports.renewMySubscription = async (req, res, next) => {
  try {
    const { billing_cycle } = req.body;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('email, plan_id, subscription_plans(name, price_monthly, price_annual, paystack_plan_code, paystack_plan_code_annual)')
      .eq('id', req.user.id)
      .single();

    if (userErr || !user) return res.status(404).json(error('User not found'));
    if (!user.plan_id || !user.subscription_plans) {
      return res.status(400).json(error('No active plan to renew. Please choose a subscription plan.'));
    }

    const cycle = billing_cycle || 'monthly';
    if (!['monthly', 'annual'].includes(cycle)) {
      return res.status(400).json(error('billing_cycle must be monthly or annual'));
    }

    const plan = user.subscription_plans;
    const basePrice = cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    if (!basePrice || Number(basePrice) <= 0) {
      return res.status(400).json(error('Current plan is not payable. Choose a paid plan to renew.'));
    }

    const paystackPlanCode = getPaystackPlanCode(plan, cycle);
    if (!paystackPlanCode) {
      return res.status(400).json(error(`Paystack plan code is not configured for the ${plan.name} ${cycle} plan`));
    }

    const paystackRes = await initializeRecurringTransaction({
      email: user.email,
      amountKobo: Math.round(Number(basePrice) * 100),
      paystackPlanCode,
      metadata: {
        user_id: req.user.id,
        plan_id: user.plan_id,
        plan_name: plan.name,
        billing_cycle: cycle,
        paystack_plan_code: paystackPlanCode,
        is_renewal: true,
        is_philanthropist: false,
        custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: plan.name },
          { display_name: 'Billing', variable_name: 'billing', value: cycle }
        ]
      },
      callbackUrl: `${process.env.FRONTEND_URL}/subscription`
    });

    return res.json(success('Renewal initiated', {
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference,
      amount: Number(basePrice),
      billing_cycle: cycle
    }));
  } catch (err) { next(err); }
};

async function persistPaystackCustomerState(userId, paystackPayload) {
  if (!userId) return;

  const customerCode = paystackPayload?.customer?.customer_code || null;
  const subscriptionCode = paystackPayload?.subscription?.subscription_code
    || paystackPayload?.subscription_code
    || null;

  if (!customerCode && !subscriptionCode) return;

  const updates = { updated_at: new Date().toISOString() };
  if (customerCode) updates.paystack_customer_id = customerCode;
  if (subscriptionCode) updates.paystack_subscription_code = subscriptionCode;

  await supabase.from('users').update(updates).eq('id', userId);
}

async function recordBillingTransactionOnce({ userId, amount, currency, reference, description, metadata }) {
  if (!reference) return;

  const existing = await hasBillingTransactionReference(reference);
  if (existing) return;

  await supabase.from('billing_transactions').insert({
    user_id: userId,
    amount,
    currency,
    type: 'payment',
    status: 'completed',
    paystack_reference: reference,
    description,
    transaction_date: new Date().toISOString(),
    metadata
  });
}

async function hasBillingTransactionReference(reference) {
  if (!reference) return false;

  const { data: existing } = await supabase
    .from('billing_transactions')
    .select('id')
    .eq('paystack_reference', reference)
    .maybeSingle();

  return !!existing;
}

async function resolveUserAndPlanFromPaystackEvent(data) {
  const customerEmail = data?.customer?.email || null;
  const customerCode = data?.customer?.customer_code || null;
  const subscriptionCode = data?.subscription?.subscription_code || data?.subscription_code || null;
  const planCode = data?.plan?.plan_code
    || data?.subscription?.plan?.plan_code
    || data?.line_items?.[0]?.plan?.plan_code
    || null;

  let user = null;

  if (subscriptionCode) {
    const lookup = await supabase
      .from('users')
      .select('id, email, plan_id, billing_cycle, paystack_customer_id, paystack_subscription_code')
      .eq('paystack_subscription_code', subscriptionCode)
      .maybeSingle();
    user = lookup.data || null;
  }

  if (!user && customerCode) {
    const lookup = await supabase
      .from('users')
      .select('id, email, plan_id, billing_cycle, paystack_customer_id, paystack_subscription_code')
      .eq('paystack_customer_id', customerCode)
      .maybeSingle();
    user = lookup.data || null;
  }

  if (!user && customerEmail) {
    const lookup = await supabase
      .from('users')
      .select('id, email, plan_id, billing_cycle, paystack_customer_id, paystack_subscription_code')
      .eq('email', customerEmail)
      .maybeSingle();
    user = lookup.data || null;
  }

  let plan = await resolveSubscriptionPlanByPaystackCode(planCode);
  if (!plan && user?.plan_id) {
    const lookup = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', user.plan_id)
      .maybeSingle();
    plan = lookup.data || null;
  }

  const billingCycle = resolveBillingCycleFromPlanCode(plan, planCode, user?.billing_cycle || 'monthly');
  return { user, plan, billingCycle, planCode };
}

function isSuccessfulInvoiceEvent(data) {
  const status = String(data?.status || '').toLowerCase();
  return status === 'success' || status === 'paid' || data?.paid === true;
}
