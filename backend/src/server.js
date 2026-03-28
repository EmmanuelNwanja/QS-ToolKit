const app = require('./app');
const logger = require('./utils/logger');
const { startCron } = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🔧 QSToolkit API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);

  // Optional inline scheduler fallback (disabled by default to avoid duplicate triggers).
  if (process.env.RUN_CRON_INLINE === 'true') {
    startCron();
    logger.info('✅ Inline cron enabled via RUN_CRON_INLINE=true');
  } else {
    logger.info('ℹ️ Inline cron disabled (set RUN_CRON_INLINE=true to enable).');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
