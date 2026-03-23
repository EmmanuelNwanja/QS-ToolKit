const router = require('express').Router();
const ctrl = require('../controllers/projectController');
const { protect } = require('../middlewares/authMiddleware');
const { checkProjectLimit } = require('../middlewares/subscriptionMiddleware');

router.use(protect);

router.get('/',          ctrl.list);
router.get('/stats',     ctrl.stats);
router.get('/:id',       ctrl.get);
router.post('/',         checkProjectLimit, ctrl.create);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);

module.exports = router;
