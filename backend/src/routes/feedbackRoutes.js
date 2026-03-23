// ── Feedback Routes ───────────────────────────────────────────
const router = require('express').Router();
const ctrl = require('../controllers/feedbackController');
const { protect } = require('../middlewares/authMiddleware');

// Public routes (no auth)
router.get('/public/:token',   ctrl.getByToken);
router.post('/public/:token',  ctrl.submit);

// Protected routes
router.use(protect);
router.get('/my-links',    ctrl.myLinks);
router.get('/my-feedback', ctrl.myFeedback);
router.post('/links',      ctrl.createLink);
router.patch('/links/:id/deactivate', ctrl.deactivate);

module.exports = router;
