// ─── Supported Countries ──────────────────────────────────────
// Flutterwave primary: Uganda, Tanzania, and countries Paystack doesn't cover
// Paystack primary: Nigeria, Ghana, South Africa, Kenya, Côte d'Ivoire

const COUNTRY_GATEWAYS = {
  NG: { gateway: 'flutterwave', currency: 'NGN', name: 'Nigeria' },
  GH: { gateway: 'flutterwave', currency: 'GHS', name: 'Ghana' },
  ZA: { gateway: 'flutterwave', currency: 'ZAR', name: 'South Africa' },
  KE: { gateway: 'flutterwave', currency: 'KES', name: 'Kenya' },
  CI: { gateway: 'flutterwave', currency: 'XOF', name: "Côte d'Ivoire" },
  UG: { gateway: 'flutterwave', currency: 'UGX', name: 'Uganda' },
  TZ: { gateway: 'flutterwave', currency: 'TZS', name: 'Tanzania' },
  US: { gateway: 'flutterwave', currency: 'USD', name: 'United States' },
  GB: { gateway: 'flutterwave', currency: 'GBP', name: 'United Kingdom' },
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
  COUNTRY_GATEWAYS,
  USD_RATES,
  getGatewayForCountry,
  convertFromNGN,
  formatCurrency
};
