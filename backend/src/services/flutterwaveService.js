const axios = require('axios');

const FLW_BASE = 'https://api.flutterwave.com/v3';
const flwHeaders = () => ({
  Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

async function initializeTransaction({ email, amount, currency, txRef, metadata, redirectUrl }) {
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

async function verifyTransaction(transactionId) {
  return axios.get(`${FLW_BASE}/transactions/${transactionId}/verify`, { headers: flwHeaders() });
}

async function verifyByReference(txRef) {
  return axios.get(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${txRef}`, { headers: flwHeaders() });
}

// ─── Supported Countries ──────────────────────────────────────
// Flutterwave primary: Uganda, Tanzania, and countries Paystack doesn't cover
// Paystack primary: Nigeria, Ghana, South Africa, Kenya, Côte d'Ivoire

const COUNTRY_GATEWAYS = {
  NG: { gateway: 'paystack', currency: 'NGN', name: 'Nigeria' },
  GH: { gateway: 'paystack', currency: 'GHS', name: 'Ghana' },
  ZA: { gateway: 'paystack', currency: 'ZAR', name: 'South Africa' },
  KE: { gateway: 'paystack', currency: 'KES', name: 'Kenya' },
  CI: { gateway: 'paystack', currency: 'XOF', name: "Côte d'Ivoire" },
  UG: { gateway: 'flutterwave', currency: 'UGX', name: 'Uganda' },
  TZ: { gateway: 'flutterwave', currency: 'TZS', name: 'Tanzania' },
  US: { gateway: 'flutterwave', currency: 'USD', name: 'United States' },
  GB: { gateway: 'flutterwave', currency: 'GBP', name: 'United Kingdom' },
  // Default fallback
  DEFAULT: { gateway: 'flutterwave', currency: 'USD', name: 'International' }
};

// ─── Currency Conversion Rates (approximate, for display) ────
const USD_RATES = {
  NGN: 1550,
  GHS: 15.5,
  ZAR: 18.5,
  KES: 155,
  UGX: 3800,
  TZS: 2500,
  XOF: 610,
  USD: 1,
  GBP: 0.79
};

function getGatewayForCountry(countryCode) {
  const code = (countryCode || '').toUpperCase();
  return COUNTRY_GATEWAYS[code] || COUNTRY_GATEWAYS.DEFAULT;
}

function convertFromNGN(amountNGN, toCurrency) {
  const rate = USD_RATES[toCurrency];
  if (!rate || toCurrency === 'NGN') return amountNGN;
  return Math.round(amountNGN / rate);
}

function formatCurrency(amount, currency) {
  const symbols = { NGN: '₦', GHS: 'GH₵', ZAR: 'R', KES: 'KSh', UGX: 'USh', TZS: 'TSh', XOF: 'CFA', USD: '$', GBP: '£' };
  return `${symbols[currency] || currency} ${(amount || 0).toLocaleString()}`;
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyByReference,
  COUNTRY_GATEWAYS,
  USD_RATES,
  getGatewayForCountry,
  convertFromNGN,
  formatCurrency
};
