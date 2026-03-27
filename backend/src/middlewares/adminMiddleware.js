const supabase = require('../config/supabase');
const { error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

const DEFAULT_ADMIN_PERMISSIONS = [
  'view_analytics',
  'manage_billing'
];

function getEffectivePermissions(adminUser = {}) {
  if (adminUser.admin_role === 'super_admin') {
    return ['*'];
  }

  const rawPermissions = Array.isArray(adminUser.permissions) ? adminUser.permissions : [];
  if (rawPermissions.length > 0) {
    return rawPermissions;
  }

  return adminUser.admin_role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : [];
}

/**
 * Middleware to verify admin access
 * Checks if user is a platform admin (not org admin)
 */
const adminAuth = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(error('Authentication required'));
    }

    // Check if user is a platform admin
    const { data: adminUser, error: dbError } = await supabase
      .from('admin_users')
      .select('id, user_id, admin_role, permissions')
      .eq('user_id', userId)
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('Admin auth check failed:', dbError);
      return res.status(500).json(error('Database error'));
    }

    if (!adminUser) {
      return res.status(403).json(error('Admin access required'));
    }

    // Attach admin info to request
    req.adminUser = adminUser;
    req.isAdmin = true;
    req.isSuperAdmin = adminUser.admin_role === 'super_admin';

    next();
  } catch (err) {
    logger.error('Admin auth middleware error:', err);
    res.status(500).json(error('Authentication error'));
  }
};

/**
 * Middleware to verify super admin access
 */
const superAdminAuth = async (req, res, next) => {
  try {
    // First check if user is admin
    if (!req.isAdmin) {
      return res.status(403).json(error('Super admin access required'));
    }

    // Check if super admin
    if (req.isSuperAdmin) {
      next();
    } else {
      return res.status(403).json(error('Super admin access required'));
    }
  } catch (err) {
    logger.error('Super admin auth middleware error:', err);
    res.status(500).json(error('Authentication error'));
  }
};

/**
 * Middleware to require specific permissions
 * @param {string|string[]} requiredPermissions
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.isAdmin) {
      return res.status(403).json(error('Admin access required'));
    }

    const permissions = getEffectivePermissions(req.adminUser);
    const permArray = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    const hasPermission = permissions.includes('*') || permArray.some(perm => permissions.includes(perm));

    if (!hasPermission && !req.isSuperAdmin) {
      return res.status(403).json(error(`Permission required: ${permArray.join(', ')}`));
    }

    next();
  };
};

/**
 * Log admin activity
 */
const logAdminActivity = async (adminUserId, action, resourceType, resourceId, details = {}, ip, userAgent) => {
  try {
    await supabase.from('admin_activity_logs').insert({
      admin_user_id: adminUserId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent
    });
  } catch (err) {
    logger.error('Failed to log admin activity:', err);
  }
};

/**
 * Middleware to capture admin activity
 */
const trackAdminActivity = (action, resourceType) => {
  return (req, res, next) => {
    // Store action info in request for later use
    req.adminAction = {
      action,
      resourceType,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    next();
  };
};

module.exports = {
  adminAuth,
  superAdminAuth,
  requirePermission,
  getEffectivePermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  logAdminActivity,
  trackAdminActivity
};
