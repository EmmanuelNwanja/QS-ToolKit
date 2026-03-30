const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },   // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

router.use(protect);

router.post('/password/force-change', ctrl.forceChangePassword);

// Profile
router.get('/profile',              ctrl.getProfile);
router.put('/profile',              ctrl.updateProfile);
router.get('/usage',                ctrl.usageSummary);

// Branding
router.put('/branding',             ctrl.updateBranding);
router.post('/branding/:asset_type', upload.single('file'), ctrl.uploadBrandingAsset);

// Team
router.get('/team',                 ctrl.getTeam);
router.post('/team/invite',         ctrl.inviteMember);
router.post('/team/join/:token',    ctrl.acceptInvite);
router.delete('/team/:memberId',    ctrl.removeMember);
router.patch('/team/:memberId/role', ctrl.updateMemberRole);

// Account management
router.post('/account/hibernate',   ctrl.hibernateAccount);
router.delete('/account',           ctrl.deleteAccount);

module.exports = router;
