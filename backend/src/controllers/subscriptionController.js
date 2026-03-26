const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const emailService = require('../services/emailService');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

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
    if (!['student', 'pro'].includes(plan_name))
      return res.status(400).json(error('Promo codes are only valid for Student and Pro plans'));

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
    if (!promo.applicable_plans.includes(plan_name))
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

    const { data: plan } = await supabase
      .from('subscription_plans').select('*').eq('name', plan_name).single();
    if (!plan || plan.price_monthly === 0)
      return res.status(400).json(error('Invalid plan for payment'));

    const { data: user } = await supabase
      .from('users').select('email, name').eq('id', req.user.id).single();
    if (!user?.email) {
      return res.status(400).json(error('User email is required to initiate payment'));
    }

    let basePrice = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    let discountApplied = 0;
    let promoId = null;

    if (promo_code && ['student', 'pro'].includes(plan_name)) {
      const { data: promo } = await supabase
        .from('promo_codes').select('*').eq('is_active', true).ilike('code', promo_code.trim()).single();
      if (promo && promo.applicable_plans.includes(plan_name)) {
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
      paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
        email: user.email,
        amount: amountKobo,
        currency: 'NGN',
        metadata: {
          user_id: req.user.id,
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle,
          promo_id: promoId,
          discount_applied: discountApplied,
          is_philanthropist: false,
          custom_fields: [
            { display_name: 'Plan',    variable_name: 'plan',    value: plan.name },
            { display_name: 'Billing', variable_name: 'billing', value: billing_cycle }
          ]
        },
        callback_url: `${process.env.FRONTEND_URL}/subscription`
      }, { headers: paystackHeaders() });
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
    if (!['student', 'pro'].includes(plan_name))
      return res.status(400).json(error('Philanthropist grants are only available for Student and Pro plans'));

    const { data: plan } = await supabase
      .from('subscription_plans').select('*').eq('name', plan_name).single();
    if (!plan) return res.status(400).json(error('Invalid plan'));

    let basePrice = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    let discountApplied = 0;
    let promoId = null;

    if (promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes').select('*').eq('is_active', true).ilike('code', promo_code.trim()).single();
      if (promo && promo.applicable_plans.includes(plan_name)) {
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
      paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
        email: donor_email,
        amount: amountKobo,
        currency: 'NGN',
        metadata: {
          is_philanthropist: true,
          grant_id: grant.id,
          beneficiary_email,
          plan_id: plan.id,
          plan_name,
          billing_cycle,
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
        callback_url: `${process.env.FRONTEND_URL}/subscription`
      }, { headers: paystackHeaders() });
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
async function activateSubscription(userId, planId, billingCycle) {
  const expiresAt = new Date();
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
      const expiresAt = await activateSubscription(meta.user_id, meta.plan_id, meta.billing_cycle || 'monthly');

      // Record billing transaction for audit and admin subscriptions view
      await supabase.from('billing_transactions').insert({
        user_id: meta.user_id,
        amount: txn.amount / 100,
        currency: txn.currency || 'NGN',
        type: 'payment',
        status: 'completed',
        paystack_reference: reference,
        description: `${meta.plan_name} plan (${meta.billing_cycle || 'monthly'}) subscription`,
        transaction_date: new Date().toISOString(),
        metadata: {
          plan_id: meta.plan_id,
          plan_name: meta.plan_name,
          billing_cycle: meta.billing_cycle
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
        await activateSubscription(meta.user_id, meta.plan_id, meta.billing_cycle || 'monthly');
        if (meta.promo_id) {
          await supabase.from('promo_code_uses').upsert(
            { promo_id: meta.promo_id, user_id: meta.user_id, plan_name: meta.plan_name },
            { onConflict: 'promo_id,user_id', ignoreDuplicates: true }
          );
        }
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
      .select('subscription_status, subscription_expires_at, billing_cycle, email, subscription_plans(*)')
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
      pending_gift:  pendingGrant || null
    }));
  } catch (err) { next(err); }
};
