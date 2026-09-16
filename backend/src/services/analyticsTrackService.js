const { PostHog } = require('posthog-node');
const logger = require('../utils/logger');

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST || 'https://app.posthog.com';

let client = null;

if (apiKey) {
  client = new PostHog(apiKey, { host });
  logger.info('[PostHog] Initialized');
} else {
  logger.warn('[PostHog] POSTHOG_API_KEY not set — analytics disabled');
}

function trackEvent(distinctId, event, properties = {}) {
  if (!client) return;
  try {
    client.capture({ event, distinctId, properties });
  } catch (err) {
    logger.error('[PostHog] Track error:', err.message);
  }
}

function identifyUser(distinctId, properties = {}) {
  if (!client) return;
  try {
    client.identify({ distinctId, properties });
  } catch (err) {
    logger.error('[PostHog] Identify error:', err.message);
  }
}

function shutdown() {
  if (!client) return;
  return client.shutdown();
}

module.exports = { trackEvent, identifyUser, shutdown };
