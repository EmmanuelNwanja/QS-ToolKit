const router = require('express').Router();
const ctrl = require('../controllers/searchController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, ctrl.globalSearch);

module.exports = router;
