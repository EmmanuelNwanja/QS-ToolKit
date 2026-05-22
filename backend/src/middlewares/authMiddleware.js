const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { error } = require('../utils/responseHelper');

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json(error('No token provided'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, user_type, plan_id, subscription_status, subscription_expires_at, org_role, organization_id, account_status, force_password_change')
      .eq('id', decoded.id)
      .single();

    // Auto-downgrade expired subscriptions in-memory (enforced on every request)
    if (user?.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
      if (user.subscription_status !== 'inactive') {
        // Async fire-and-forget: update DB so cron doesn't have to catch it
        supabase.from('users').update({ subscription_status: 'inactive' }).eq('id', user.id).then();
      }
      user.subscription_status = 'inactive';
      user.plan_id = null;
    }

    if (!user) return res.status(401).json(error('User not found'));

    if (user.account_status === 'deleted') {
      return res.status(401).json(error('This account has been deleted'));
    }

    const originalUrl = String(req.originalUrl || '');
    const isAllowedForceChangeRoute = originalUrl.startsWith('/api/v1/users/password/force-change')
      || originalUrl.startsWith('/api/v1/auth/me');

    if (user.force_password_change && !isAllowedForceChangeRoute) {
      return res.status(403).json(error('Password change required before continuing.', {
        code: 'FORCE_PASSWORD_CHANGE_REQUIRED'
      }));
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json(error('Invalid or expired token'));
  }
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.org_role)) {
    return res.status(403).json(error('Insufficient permissions'));
  }
  next();
};
