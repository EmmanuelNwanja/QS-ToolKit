const router = require('express').Router();

router.use('/auth',         require('./authRoutes'));
router.use('/users',        require('./userRoutes'));
router.use('/projects',     require('./projectRoutes'));
router.use('/calculators',  require('./calculatorRoutes'));
router.use('/boq',          require('./boqRoutes'));
router.use('/invoices',     require('./invoiceRoutes'));
router.use('/feedback',     require('./feedbackRoutes'));
router.use('/leaderboard',  require('./leaderboardRoutes'));
router.use('/subscriptions',require('./subscriptionRoutes'));
router.use('/cron',         require('./cronRoutes'));

module.exports = router;
