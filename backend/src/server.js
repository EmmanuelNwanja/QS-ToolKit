const app = require('./app');
const logger = require('./utils/logger');
const { startCron } = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;

// ─── Startup: Validate AI Provider Configuration ──────────────
const aiProviders = {
  gemini: !!process.env.GEMINI_API_KEY,
  groq: !!process.env.GROQ_API_KEY,
  openrouter: !!process.env.OPENROUTER_API_KEY,
  jina: !!process.env.JINA_API_KEY
};
const activeProviders = Object.entries(aiProviders).filter(([, v]) => v).map(([k]) => k);
if (activeProviders.length === 0) {
  logger.warn('⚠️  No AI provider API keys configured. Auto-BOQ, Dr. Q chat, and forecasting will use local/template fallbacks only.');
  logger.warn('   Set GEMINI_API_KEY, GROQ_API_KEY, and/or OPENROUTER_API_KEY in your environment.');
} else {
  logger.info(`✅ AI providers active: ${activeProviders.join(', ')}`);
}

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
