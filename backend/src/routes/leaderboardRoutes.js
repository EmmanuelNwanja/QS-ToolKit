const router = require('express').Router();
const ctrl = require('../controllers/leaderboardController');
const { protect } = require('../middlewares/authMiddleware');

// ponytail: leaderboard is student-only
function studentsOnly(req, res, next) {
  if (req.user?.user_type !== 'student') {
    return res.status(403).json({ error: 'Leaderboard is available for student accounts only.' });
  }
  next();
}

router.get('/',       protect, studentsOnly, ctrl.getLeaderboard);
router.get('/me',     protect, studentsOnly, ctrl.getMyRank);

module.exports = router;
