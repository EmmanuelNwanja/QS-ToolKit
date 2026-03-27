const router = require('express').Router();
const ctrl = require('../controllers/invoiceController');
const { protect } = require('../middlewares/authMiddleware');
const { requireSubscription, checkInvoiceLimit } = require('../middlewares/subscriptionMiddleware');

router.use(protect, requireSubscription('basic'));

router.get('/',                                      ctrl.list);
router.post('/',         checkInvoiceLimit,           ctrl.create);
router.get('/:id',                                   ctrl.get);
router.put('/:id',                                   ctrl.update);
router.delete('/:id',                                ctrl.remove);
router.get('/:id/export/pdf',                        ctrl.exportPdf);
router.get('/:id/export/excel',                      ctrl.exportExcel);
router.post('/:id/send',                             ctrl.sendToClient);

module.exports = router;
