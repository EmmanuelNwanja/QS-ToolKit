const axios = require('axios');
const { getGatewayForCountry, convertFromNGN } = require('./flutterwaveService');

// ─── Flutterwave Helpers ──────────────────────────────────────

const FLW_BASE = 'https://api.flutterwave.com/v3';
const flwHeaders = () => ({
  Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

async function flutterwaveInitialize({ email, amount, currency, txRef, metadata, redirectUrl, paymentPlan }) {
  const payload = {
    tx_ref: txRef,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer: { email },
    meta: metadata
  };
  if (paymentPlan) payload.payment_plan = paymentPlan;
  return axios.post(`${FLW_BASE}/payments`, payload, { headers: flwHeaders() });
}

async function flutterwaveVerify(transactionId) {
  return axios.get(`${FLW_BASE}/transactions/${transactionId}/verify`, { headers: flwHeaders() });
}

async function flutterwaveVerifyByReference(txRef) {
  const res = await axios.get(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${txRef}`, { headers: flwHeaders() });
  const tx = res.data.data;
  return {
    success: tx.status === 'successful',
    gateway: 'flutterwave',
    reference: tx.tx_ref,
    amount: tx.amount,
    currency: tx.currency,
    customer_email: tx.customer?.email,
    flw_transaction_id: tx.id,
    paid_at: tx.created_at
  };
}

async function flutterwaveCancelSubscription(subscriptionId) {
  return axios.get(`${FLW_BASE}/subscriptions/${subscriptionId}/cancel`, { headers: flwHeaders() });
}

async function flutterwaveGetSubscription(subscriptionId) {
  return axios.get(`${FLW_BASE}/subscriptions/${subscriptionId}`, { headers: flwHeaders() });
}

async function flutterwaveGetSubscriptionsByEmail(email) {
  const res = await axios.get(`${FLW_BASE}/subscriptions?email=${encodeURIComponent(email)}`, { headers: flwHeaders() });
  return res.data?.data || [];
}

async function flutterwaveCreateRefund(transactionId, amount) {
  const res = await axios.post(
    `${FLW_BASE}/transactions/${transactionId}/refund`,
    { amount },
    { headers: flwHeaders() }
  );
  return res.data?.data || res.data;
}

function verifyFlutterwaveSignature(body, signature) {
  const crypto = require('crypto');
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secretHash) return false;
  const expectedHash = crypto.createHmac('sha256', secretHash).update(JSON.stringify(body)).digest('hex');
  return expectedHash === signature;
}

// ─── Unified Gateway Router ───────────────────────────────────

function generateTxRef(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Initialize a payment via Flutterwave (sole payment gateway).
 * @param {Object} opts
 * @param {string} opts.email - Customer email
 * @param {string} opts.amountNGN - Amount in NGN (will be converted for non-NGN currencies)
 * @param {string} opts.country - ISO country code (NG, GH, UG, etc.)
 * @param {Object} opts.metadata - Transaction metadata object
 * @param {string} opts.callbackUrl - Redirect URL after payment
 * @param {string} opts.txPrefix - tx_ref prefix (e.g., 'sub', 'academy', 'exam')
 * @param {string} opts.paymentPlan - Flutterwave payment plan ID (recurring billing)
 */
async function initializePayment({ email, amountNGN, country, metadata, callbackUrl, txPrefix, paymentPlan }) {
  const gw = getGatewayForCountry(country);
  const amountFLW = convertFromNGN(amountNGN, gw.currency);
  const txRef = generateTxRef(txPrefix || 'qst');
  const res = await flutterwaveInitialize({
    email,
    amount: amountFLW,
    currency: gw.currency,
    txRef,
    metadata: { ...metadata, flw_tx_ref: txRef, project: 'qstoolkit' },
    redirectUrl: `${callbackUrl}?tx_ref=${txRef}`,
    paymentPlan: paymentPlan || undefined
  });
  return {
    gateway: 'flutterwave',
    authorization_url: res.data.data.link,
    reference: txRef,
    flw_transaction_id: res.data.data.id,
    currency: gw.currency,
    amount: amountFLW
  };
}

/**
 * Verify a payment by reference.
 */
async function verifyPayment(reference, gateway) {
  const res = await flutterwaveVerify(reference);
  const tx = res.data.data;
  return {
    success: tx.status === 'successful',
    gateway: 'flutterwave',
    reference: tx.tx_ref,
    amount: tx.amount,
    currency: tx.currency,
    customer_email: tx.customer?.email,
    flw_transaction_id: tx.id,
    paid_at: tx.created_at
  };
}

module.exports = {
  initializePayment,
  verifyPayment,
  verifyFlutterwaveSignature,
  flutterwaveVerifyByReference,
  flutterwaveCreateRefund,
  generateTxRef,
  flutterwaveInitialize,
  flutterwaveVerify,
  flutterwaveCancelSubscription,
  flutterwaveGetSubscription,
  flutterwaveGetSubscriptionsByEmail
};
