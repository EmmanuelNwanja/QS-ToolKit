const express = require('express');
const router = express.Router();
const { adminAuth, superAdminAuth } = require('../middlewares/adminMiddleware');
const quotaController = require('../controllers/quotaController');

router.use(adminAuth);

router.get('/usage', quotaController.getUsageOverview);
router.get('/usage/:userId', quotaController.getUserUsage);
router.get('/features', quotaController.getFeatures);
router.get('/config', quotaController.getConfig);
router.post('/config', superAdminAuth, quotaController.createConfig);
router.patch('/config/:id', superAdminAuth, quotaController.updateConfig);

module.exports = router;
