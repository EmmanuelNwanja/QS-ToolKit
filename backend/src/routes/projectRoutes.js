const router = require('express').Router();
const ctrl = require('../controllers/projectController');
const milestoneCtrl = require('../controllers/milestoneController');
const { protect } = require('../middlewares/authMiddleware');
const { checkProjectLimit } = require('../middlewares/subscriptionMiddleware');

router.use(protect);

router.get('/',          ctrl.list);
router.get('/stats',     ctrl.stats);
router.get('/:id/milestones', milestoneCtrl.list);
router.get('/:id',       ctrl.get);
router.post('/',         checkProjectLimit, ctrl.create);
router.post('/:id/milestones', milestoneCtrl.create);
router.patch('/:id/milestones/:milestoneId', milestoneCtrl.update);
router.delete('/:id/milestones/:milestoneId', milestoneCtrl.remove);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);

module.exports = router;
