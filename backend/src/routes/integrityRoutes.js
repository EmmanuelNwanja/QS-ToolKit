const router = require('express').Router();
const ctrl = require('../controllers/integrityController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Certify documents
router.post('/boq/:id/certify', ctrl.certifyBoq);
router.post('/invoice/:id/certify', ctrl.certifyInvoice);

// Verify (public — no auth needed)
router.get('/verify/:token', ctrl.verify);

// History
router.get('/history/:type/:id', ctrl.getHistory);

// Download certificate
router.get('/certificate/:token/download', ctrl.downloadCertificate);

module.exports = router;
