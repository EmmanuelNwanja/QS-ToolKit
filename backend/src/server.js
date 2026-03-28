const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Temporary Mailjet Domain Validation Route
app.get('/781acd2d89510a5183db97367002c640.txt', (req, res) => {
  res.type('text/plain');
  res.send('');
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🔧 QSToolkit API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
