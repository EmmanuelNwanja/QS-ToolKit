const https = require('https');
const logger = require('../utils/logger');

/**
 * Paystack API Configuration and Helper Functions
 */

const PAYSTACK_BASE_URL = 'api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  logger.warn('PAYSTACK_SECRET_KEY is not set in environment variables');
}

/**
 * Make an authenticated request to the Paystack API
 * @param {string} method - HTTP method (GET, POST, etc)
 * @param {string} path - API path (e.g., /transaction/verify/ref)
 * @param {object} data - Request payload (for POST/PUT)
 */
const makeRequest = async (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PAYSTACK_BASE_URL,
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    let body = '';
    if (data) {
      body = JSON.stringify(data);
      options.headers['Content-Length'] = body.length;
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(responseBody);
          if (result.status) {
            resolve(result);
          } else {
            reject(new Error(result.message || 'Paystack request failed'));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Paystack response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
};

/**
 * Create a refund in Paystack
 * @param {string} transactionReference - Paystack transaction reference
 * @param {number} amount - Refund amount in Naira
 */
exports.createRefund = async (transactionReference, amount) => {
  try {
    logger.info(`Creating Paystack refund for transaction ${transactionReference}: ₦${amount}`);
    
    const response = await makeRequest('POST', '/refund', {
      transaction: transactionReference,
      amount: Math.round(amount * 100) // Convert to kobo
    });

    logger.info(`Paystack refund created: ${response.data.reference}`);
    return response.data;
  } catch (err) {
    logger.error('Error creating Paystack refund:', err);
    throw new Error(`Paystack refund creation failed: ${err.message}`);
  }
};

/**
 * Verify a transaction with Paystack
 * @param {string} reference - Paystack transaction reference
 */
exports.verifyTransaction = async (reference) => {
  try {
    logger.info(`Verifying Paystack transaction: ${reference}`);
    
    const response = await makeRequest('GET', `/transaction/verify/${reference}`);
    
    return response.data;
  } catch (err) {
    logger.error('Error verifying Paystack transaction:', err);
    throw new Error(`Transaction verification failed: ${err.message}`);
  }
};

/**
 * Get transaction details
 * @param {number} transactionId - Paystack transaction ID
 */
exports.getTransaction = async (transactionId) => {
  try {
    logger.info(`Fetching Paystack transaction: ${transactionId}`);
    
    const response = await makeRequest('GET', `/transaction/${transactionId}`);
    
    return response.data;
  } catch (err) {
    logger.error('Error fetching Paystack transaction:', err);
    throw new Error(`Failed to fetch transaction: ${err.message}`);
  }
};

/**
 * Fetch refund details
 * @param {number} refundId - Paystack refund ID
 */
exports.getRefund = async (refundId) => {
  try {
    logger.info(`Fetching Paystack refund: ${refundId}`);
    
    const response = await makeRequest('GET', `/refund/${refundId}`);
    
    return response.data;
  } catch (err) {
    logger.error('Error fetching Paystack refund:', err);
    throw new Error(`Failed to fetch refund: ${err.message}`);
  }
};

/**
 * List transactions with pagination
 * @param {number} perPage - Items per page
 * @param {number} page - Page number
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 */
exports.listTransactions = async (perPage = 50, page = 1, from = null, to = null) => {
  try {
    let path = `/transaction?perPage=${perPage}&page=${page}`;
    if (from) path += `&from=${from}`;
    if (to) path += `&to=${to}`;

    logger.info(`Fetching Paystack transactions page ${page}`);
    
    const response = await makeRequest('GET', path);
    
    return response.data;
  } catch (err) {
    logger.error('Error listing Paystack transactions:', err);
    throw new Error(`Failed to list transactions: ${err.message}`);
  }
};

/**
 * Check Paystack API availability
 */
exports.healthCheck = async () => {
  try {
    // Try to list one transaction to verify API connectivity
    await makeRequest('GET', '/transaction?perPage=1&page=1');
    return { status: 'ok', message: 'Paystack API is accessible' };
  } catch (err) {
    return { status: 'error', message: `Paystack API error: ${err.message}` };
  }
};

module.exports = exports;
