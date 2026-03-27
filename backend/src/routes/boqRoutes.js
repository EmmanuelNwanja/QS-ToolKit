const router = require('express').Router();
const ctrl = require('../controllers/boqController');
const { protect } = require('../middlewares/authMiddleware');
const { requireSubscription, checkBoqLimit } = require('../middlewares/subscriptionMiddleware');

router.use(protect);

router.get('/',                                                           ctrl.list);
router.post('/',              requireSubscription('basic'), checkBoqLimit, ctrl.create);
router.get('/:id',                                                        ctrl.get);
router.put('/:id',            requireSubscription('basic'),               ctrl.update);
router.delete('/:id',         requireSubscription('basic'),               ctrl.remove);

// Sections
router.post('/:id/sections',  requireSubscription('basic'), ctrl.addSection);

// Items
router.post('/:id/sections/:sectionId/items', requireSubscription('basic'), ctrl.addItem);
router.put('/:id/sections/:sectionId/items/:itemId', requireSubscription('basic'), ctrl.updateItem);
router.delete('/:id/sections/:sectionId/items/:itemId', requireSubscription('basic'), ctrl.removeItem);

// Exports
router.get('/:id/export/pdf',   requireSubscription('basic'), ctrl.exportPdf);
router.get('/:id/export/excel', requireSubscription('basic'), ctrl.exportExcel);

module.exports = router;
