const router = require('express').Router();
const ctrl = require('../controllers/boqController');
const { protect } = require('../middlewares/authMiddleware');
const { requireSubscription } = require('../middlewares/subscriptionMiddleware');

router.use(protect);

router.get('/',                                       ctrl.list);
router.post('/',              requireSubscription('pro'), ctrl.create);
router.get('/:id',                                    ctrl.get);
router.put('/:id',            requireSubscription('pro'), ctrl.update);
router.delete('/:id',         requireSubscription('pro'), ctrl.remove);

// Sections
router.post('/:id/sections',  requireSubscription('pro'), ctrl.addSection);

// Items
router.post('/:id/sections/:sectionId/items', requireSubscription('pro'), ctrl.addItem);
router.put('/:id/sections/:sectionId/items/:itemId', requireSubscription('pro'), ctrl.updateItem);
router.delete('/:id/sections/:sectionId/items/:itemId', requireSubscription('pro'), ctrl.removeItem);

// Exports
router.get('/:id/export/pdf',   requireSubscription('pro'), ctrl.exportPdf);
router.get('/:id/export/excel', requireSubscription('pro'), ctrl.exportExcel);

module.exports = router;
