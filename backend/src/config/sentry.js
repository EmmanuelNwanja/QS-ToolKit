const Sentry = require('@sentry/node');
const { environment } = require('./environment');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || environment,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  beforeSend(event) {
    if (event.request?.url?.includes('/health')) return null;
    const ua = event.request?.headers?.['user-agent'] || '';
    if (/bot|crawler|spider|curl|wget/i.test(ua)) return null;
    return event;
  },
});

module.exports = Sentry;
