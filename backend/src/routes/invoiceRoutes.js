const router = require('express').Router();
const ctrl = require('../controllers/invoiceController');
const { protect } = require('../middlewares/authMiddleware');
const { requireSubscription } = require('../middlewares/subscriptionMiddleware');

router.use(protect, requireSubscription('pro'));

router.get('/',                    ctrl.list);
router.post('/',                   ctrl.create);
router.get('/:id',                 ctrl.get);
router.put('/:id',                 ctrl.update);
router.delete('/:id',              ctrl.remove);
router.get('/:id/export/pdf',      ctrl.exportPdf);
router.get('/:id/export/excel',    ctrl.exportExcel);
router.post('/:id/send',           ctrl.sendToClient);

module.exports = router;
