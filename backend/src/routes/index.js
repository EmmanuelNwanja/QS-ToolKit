const router = require('express').Router();

router.use('/auth',         require('./authRoutes'));
router.use('/users',        require('./userRoutes'));
router.use('/user-actions', require('./userActionsRoutes'));
router.use('/projects',     require('./projectRoutes'));
router.use('/calculators',  require('./calculatorRoutes'));
router.use('/boq',          require('./boqRoutes'));
router.use('/invoices',     require('./invoiceRoutes'));
router.use('/feedback',     require('./feedbackRoutes'));
router.use('/leaderboard',  require('./leaderboardRoutes'));
router.use('/subscriptions',require('./subscriptionRoutes'));
router.use('/cron',         require('./cronRoutes'));
router.use('/admin',        require('./adminRoutes'));
router.use('/push-notifications', require('./pushRoutes'));
router.use('/billing',      require('./billingRoutes'));
router.use('/analytics',    require('./analyticsRoutes'));
router.use('/ai',            require('./aiRoutes'));
router.use('/integrity',     require('./integrityRoutes'));
router.use('/academy',       require('./academyRoutes'));
router.use('/exam-prep',     require('./examPrepRoutes'));
router.use('/',              require('./boqRevisionRoutes'));

module.exports = router;
