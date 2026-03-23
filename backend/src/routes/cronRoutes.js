const router = require('express').Router();
const { runAllJobs } = require('../services/schedulerService');
const logger = require('../utils/logger');

// Secured cron endpoint - called by GitHub Actions
router.post('/run', async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    await runAllJobs();
    return res.json({ success: true, message: 'Jobs completed', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Cron run error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
