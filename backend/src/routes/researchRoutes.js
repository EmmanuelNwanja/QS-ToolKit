const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/researchController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../utils/validators');

// All routes require authentication
router.use(protect);

// ── Projects ──────────────────────────────────────────────────
router.post('/projects', [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('research_type').isIn(['literature_review', 'cost_data_analysis', 'methodology_guide', 'case_study', 'comparative_analysis', 'policy_review', 'other']).withMessage('Invalid research_type'),
  body('description').optional().isString(),
  body('tags').optional().isArray(),
  validate
], ctrl.createProject);

router.get('/projects', [
  query('status').optional().isIn(['draft', 'in_progress', 'under_review', 'completed', 'archived']),
  validate
], ctrl.getProjects);

router.get('/projects/:id', [
  param('id').isUUID().withMessage('Valid project ID required'),
  validate
], ctrl.getProject);

router.put('/projects/:id', [
  param('id').isUUID().withMessage('Valid project ID required'),
  body('title').optional().trim().notEmpty(),
  body('description').optional().isString(),
  body('tags').optional().isArray(),
  body('is_public').optional().isBoolean(),
  validate
], ctrl.updateProject);

router.delete('/projects/:id', [
  param('id').isUUID().withMessage('Valid project ID required'),
  validate
], ctrl.deleteProject);

// ── Stage Advancement ─────────────────────────────────────────
router.post('/projects/:id/advance', [
  param('id').isUUID().withMessage('Valid project ID required'),
  validate
], ctrl.advanceStage);

router.post('/projects/:id/stage', [
  param('id').isUUID().withMessage('Valid project ID required'),
  body('stage_num').isInt({ min: 1, max: 10 }).withMessage('stage_num must be 1-10'),
  body('data').isObject().withMessage('data must be an object'),
  validate
], ctrl.updateStageData);

// ── AI Assist ─────────────────────────────────────────────────
router.post('/projects/:id/ai-assist', [
  param('id').isUUID().withMessage('Valid project ID required'),
  body('stage_num').optional().isInt({ min: 1, max: 10 }),
  body('prompt').optional().isString(),
  validate
], ctrl.aiAssist);

// ── Sources ───────────────────────────────────────────────────
router.get('/sources', [
  query('search').optional().isString(),
  query('type').optional().isIn(['journal', 'book', 'report', 'standard', 'thesis', 'website', 'niqs_bulletin', 'government_data']),
  query('region').optional().isString(),
  query('year_from').optional().isInt({ min: 1900, max: 2030 }),
  query('year_to').optional().isInt({ min: 1900, max: 2030 }),
  validate
], ctrl.getSources);

router.post('/sources', [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('source_type').isIn(['journal', 'book', 'report', 'standard', 'thesis', 'website', 'niqs_bulletin', 'government_data']).withMessage('Invalid source_type'),
  body('authors').optional().isArray(),
  body('year').optional().isInt({ min: 1900, max: 2030 }),
  body('url').optional().isURL(),
  body('doi').optional().isString(),
  body('abstract').optional().isString(),
  body('keywords').optional().isArray(),
  body('region').optional().isString(),
  validate
], ctrl.addSource);

// ── Cost Data ─────────────────────────────────────────────────
router.get('/cost-data', [
  query('item').optional().isString(),
  query('region').optional().isString(),
  query('project_type').optional().isString(),
  query('year').optional().isInt({ min: 2000, max: 2030 }),
  validate
], ctrl.getCostData);

router.post('/cost-data', [
  body('item_description').trim().notEmpty().withMessage('item_description is required'),
  body('unit').trim().notEmpty().withMessage('unit is required'),
  body('rate_ngn').isFloat({ min: 0 }).withMessage('rate_ngn must be a positive number'),
  body('region').trim().notEmpty().withMessage('region is required'),
  body('state').optional().isString(),
  body('source').optional().isString(),
  body('project_type').optional().isString(),
  body('tags').optional().isArray(),
  validate
], ctrl.addCostData);

router.get('/cost-data/aggregate', [
  query('item').trim().notEmpty().withMessage('item query parameter is required'),
  validate
], ctrl.getCostAggregate);

// ── Templates ─────────────────────────────────────────────────
router.get('/templates', ctrl.getTemplates);

// ── Collaborations ────────────────────────────────────────────
router.post('/projects/:id/collaborate', [
  param('id').isUUID().withMessage('Valid project ID required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('role').optional().isIn(['editor', 'reviewer', 'viewer']),
  validate
], ctrl.inviteCollaborator);

// ── Subscription ────────────────────────────────────────────────
router.get('/subscription/status', ctrl.getSubscriptionStatus);

router.post('/subscription/subscribe', [
  body('payment_method').isIn(['card', 'bank_transfer']).withMessage('payment_method must be card or bank_transfer'),
  body('billing_cycle').optional().isIn(['weekly', 'monthly', 'annual']),
  body('referenceNote').optional().isString(),
  validate
], ctrl.subscribe);

router.post('/subscription/cancel', ctrl.cancelSubscription);

module.exports = router;
