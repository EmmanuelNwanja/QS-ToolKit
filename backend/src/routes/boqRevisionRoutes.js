const router = require('express').Router();
const ctrl = require('../controllers/boqRevisionController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/boq/:id/revisions', ctrl.listRevisions);
router.get('/boq/:id/revisions/:revId', ctrl.getRevision);
router.get('/boq/:id/variance', ctrl.compareRevisions);

module.exports = router;
