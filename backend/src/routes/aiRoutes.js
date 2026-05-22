const router = require('express').Router();
const ctrl = require('../controllers/aiController');
const { protect } = require('../middlewares/authMiddleware');

// Public health check (no auth required for diagnostics)
router.get('/health', ctrl.health);

router.use(protect);

// Chat
router.post('/chat', ctrl.chat);
router.get('/chat/history', ctrl.getChatHistory);

// Drawing Analysis (Auto-BOQ)
router.post('/drawings/analyze', ctrl.analyzeDrawing);
router.get('/drawings/jobs', ctrl.listDrawingJobs);
router.get('/drawings/jobs/:id', ctrl.getDrawingJob);

// Cost Forecasting
router.get('/forecast/:project_id', ctrl.getForecast);

// Smart Rates
router.get('/rates/suggest', ctrl.getRateSuggestion);

// Admin AI (admin only) — org admins bypass via checkFeature, platform admins via adminAuth
router.post('/admin/query', protect, ctrl.adminQuery);

// Admin AI Engine — full conversational chat for admins
router.post('/admin/chat', protect, ctrl.adminChat);
router.get('/admin/chat/history', protect, ctrl.getAdminChatHistory);

// Admin AI Access Control (super admin only)
router.post('/admin/grant', protect, ctrl.grantAdminAI);
router.delete('/admin/grant/:user_id', protect, ctrl.revokeAdminAI);
router.get('/admin/grants', protect, ctrl.listAdminAIGrants);

module.exports = router;
