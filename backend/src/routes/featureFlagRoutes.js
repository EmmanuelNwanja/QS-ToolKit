const express = require('express');
const router = express.Router();
const { adminAuth, superAdminAuth } = require('../middlewares/adminMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const featureFlagController = require('../controllers/featureFlagController');

// Public endpoint - get enabled flags for current user
router.get('/enabled', protect, featureFlagController.getEnabled);

// Admin endpoints
router.get('/', adminAuth, featureFlagController.list);
router.post('/', superAdminAuth, featureFlagController.create);
router.patch('/:id', superAdminAuth, featureFlagController.update);
router.delete('/:id', superAdminAuth, featureFlagController.remove);

module.exports = router;
