const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const emailService = require('../services/emailService');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

// ─── Get all plans ────────────────────────────────────────────
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

// ─── Initiate payment ─────────────────────────────────────────
exports.initiate = async (req, res, next) => {
  try {
    const { plan_name } = req.body;

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', plan_name)
      .single();

    if (!plan || plan.price_monthly === 0) {
      return res.status(400).json(error('Invalid plan for payment'));
    }

    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', req.user.id)
      .single();

    const amountKobo = plan.price_monthly * 100;  // Paystack uses kobo

    const paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
      email: user.email,
      amount: amountKobo,
      currency: 'NGN',
      metadata: {
        user_id: req.user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: plan.name }
        ]
      },
      callback_url: `${process.env.FRONTEND_URL}/subscription/verify`
    }, { headers: paystackHeaders() });

    return res.json(success('Payment initiated', {
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference
    }));
  } catch (err) { next(err); }
};

// ─── Verify payment ───────────────────────────────────────────
exports.verify = async (req, res, next) => {
  try {
    const { reference } = req.query;

    const paystackRes = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: paystackHeaders() }
    );

    const txn = paystackRes.data.data;
    if (txn.status !== 'success') {
      return res.status(400).json(error('Payment not successful'));
    }

    const { user_id, plan_id } = txn.metadata;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await supabase.from('users').update({
      plan_id,
      subscription_status: 'active',
      subscription_expires_at: expiresAt.toISOString()
    }).eq('id', user_id);

    const { data: user } = await supabase.from('users').select('email, name, subscription_plans(name)').eq('id', user_id).single();
    await emailService.sendSubscriptionConfirmation(user);

    return res.json(success('Subscription activated', {
      plan: txn.metadata.plan_name,
      expires_at: expiresAt.toISOString()
    }));
  } catch (err) { next(err); }
};

// ─── Paystack webhook ─────────────────────────────────────────
exports.webhook = async (req, res, next) => {
  try {
    const hash = require('crypto')
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const { user_id, plan_id } = data.metadata || {};
      if (user_id && plan_id) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        await supabase.from('users').update({
          plan_id,
          subscription_status: 'active',
          subscription_expires_at: expiresAt.toISOString()
        }).eq('id', user_id);
      }
    }

    if (event === 'subscription.disable') {
      const customerEmail = data.customer?.email;
      if (customerEmail) {
        await supabase.from('users')
          .update({ subscription_status: 'inactive' })
          .eq('email', customerEmail);
      }
    }

    return res.sendStatus(200);
  } catch (err) { next(err); }
};

// ─── Get my subscription ──────────────────────────────────────
exports.mySubscription = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_expires_at, subscription_plans(*)')
      .eq('id', req.user.id)
      .single();

    return res.json(success('Subscription info', {
      status: user.subscription_status,
      plan: user.subscription_plans,
      expires_at: user.subscription_expires_at
    }));
  } catch (err) { next(err); }
};
