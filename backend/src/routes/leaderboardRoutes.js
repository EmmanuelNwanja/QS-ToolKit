const router = require('express').Router();
const ctrl = require('../controllers/leaderboardController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/',       ctrl.getLeaderboard);          // public
router.get('/me',     protect, ctrl.getMyRank);      // authenticated

module.exports = router;
