const axios = require('axios');
const { getGatewayForCountry, convertFromNGN } = require('./flutterwaveService');

// ─── Paystack Helpers ─────────────────────────────────────────

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

async function paystackInitialize({ email, amountKobo, currency, metadata, callbackUrl, planCode }) {
  const payload = {
    email,
    amount: amountKobo,
    currency: currency || 'NGN',
    metadata,
    callback_url: callbackUrl
  };
  if (planCode) payload.plan = planCode;
  return axios.post(`${PAYSTACK_BASE}/transaction/initialize`, payload, { headers: paystackHeaders() });
}

async function paystackVerify(reference) {
  return axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, { headers: paystackHeaders() });
}

// ─── Flutterwave Helpers ──────────────────────────────────────

const FLW_BASE = 'https://api.flutterwave.com/v3';
const flwHeaders = () => ({
  Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

async function flutterwaveInitialize({ email, amount, currency, txRef, metadata, redirectUrl }) {
  const payload = {
    tx_ref: txRef,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer: { email },
    meta: metadata
  };
  return axios.post(`${FLW_BASE}/payments`, payload, { headers: flwHeaders() });
}

async function flutterwaveVerify(transactionId) {
  return axios.get(`${FLW_BASE}/transactions/${transactionId}/verify`, { headers: flwHeaders() });
}

// ─── Unified Gateway Router ───────────────────────────────────

function generateTxRef(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Initialize a payment with the correct gateway based on user country.
 * @param {Object} opts
 * @param {string} opts.email - Customer email
 * @param {string} opts.amountNGN - Amount in NGN (will be converted for non-NGN gateways)
 * @param {string} opts.country - ISO country code (NG, GH, UG, etc.)
 * @param {string} opts.metadata - Transaction metadata object
 * @param {string} opts.callbackUrl - Redirect URL after payment
 * @param {string} opts.txPrefix - tx_ref prefix (e.g., 'sub', 'academy', 'exam')
 * @param {string} opts.paystackPlanCode - Paystack plan code (Paystack only)
 */
async function initializePayment({ email, amountNGN, country, metadata, callbackUrl, txPrefix, paystackPlanCode }) {
  const gw = getGatewayForCountry(country);

  if (gw.gateway === 'paystack') {
    // Paystack amounts in kobo (NGN * 100)
    const amountKobo = Math.round(amountNGN * 100);
    const res = await paystackInitialize({
      email,
      amountKobo,
      currency: gw.currency,
      metadata,
      callbackUrl,
      planCode: paystackPlanCode
    });
    return {
      gateway: 'paystack',
      authorization_url: res.data.data.authorization_url,
      reference: res.data.data.reference,
      currency: gw.currency,
      amount: amountKobo
    };
  }

  // Flutterwave
  const amountFLW = convertFromNGN(amountNGN, gw.currency);
  const txRef = generateTxRef(txPrefix || 'qst');
  const res = await flutterwaveInitialize({
    email,
    amount: amountFLW,
    currency: gw.currency,
    txRef,
    metadata: { ...metadata, flw_tx_ref: txRef },
    redirectUrl: `${callbackUrl}?tx_ref=${txRef}`
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
 * Verify a payment by reference. Routes to the correct gateway.
 */
async function verifyPayment(reference, gateway) {
  if (gateway === 'flutterwave') {
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

  // Paystack (default)
  const res = await paystackVerify(reference);
  const tx = res.data.data;
  return {
    success: tx.status === 'success',
    gateway: 'paystack',
    reference: tx.reference,
    amount: tx.amount / 100, // kobo to naira
    currency: tx.currency,
    customer_email: tx.customer?.email,
    paystack_customer_code: tx.customer?.customer_code,
    authorization_code: tx.authorization?.authorization_code,
    paid_at: tx.paid_at
  };
}

/**
 * Verify Flutterwave webhook signature.
 */
function verifyFlutterwaveSignature(body, signature) {
  const crypto = require('crypto');
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secretHash) return false;
  const expectedHash = crypto.createHmac('sha256', secretHash).update(JSON.stringify(body)).digest('hex');
  return expectedHash === signature;
}

module.exports = {
  initializePayment,
  verifyPayment,
  verifyFlutterwaveSignature,
  generateTxRef,
  // Export individual gateway functions for direct use
  paystackInitialize,
  paystackVerify,
  flutterwaveInitialize,
  flutterwaveVerify
};
