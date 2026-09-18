const router = require('express').Router();
const ctrl = require('../controllers/integrityController');
const { protect } = require('../middlewares/authMiddleware');

// Public routes — no auth required (third-party verification)
router.get('/verify/:token', ctrl.verify);
router.get('/certificate/:token/download', ctrl.downloadCertificate);

// Protected routes — auth required
router.use(protect);

// Certify documents
router.post('/boq/:id/certify', ctrl.certifyBoq);
router.post('/invoice/:id/certify', ctrl.certifyInvoice);

// Revoke certificate
router.post('/revoke/:token', ctrl.revoke);

// History
router.get('/history/:type/:id', ctrl.getHistory);

module.exports = router;
