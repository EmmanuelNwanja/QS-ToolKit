const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { logAdminActivity } = require('../middlewares/adminMiddleware');
const { getEffectivePermissions, DEFAULT_ADMIN_PERMISSIONS } = require('../middlewares/adminMiddleware');
const crypto = require('crypto');

// ── ADMIN MANAGEMENT ────────────────────────────────────────
/**
 * Create a new admin user (super_admin only)
 */
exports.createAdmin = async (req, res, next) => {
  try {
    const { userId, adminRole = 'admin', permissions = [] } = req.body;
    const normalizedPermissions = Array.isArray(permissions) && permissions.length > 0
      ? permissions
      : (adminRole === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : []);

    // Verify target user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Check if already admin
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return res.status(409).json(error('User is already an admin'));
    }

    // Create admin record
    const { data: adminUser, error: dbError } = await supabase
      .from('admin_users')
      .insert({
        user_id: userId,
        admin_role: adminRole,
        permissions: normalizedPermissions,
        created_by: req.adminUser.user_id
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'created_admin',
      'admin_user',
      adminUser.id,
      { email: user.email, admin_role: adminRole },
      req.ip,
      req.get('user-agent')
    );

    return res.status(201).json(success('Admin created successfully', {
      admin: { ...adminUser, user: user }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get all admins
 */
exports.getAdmins = async (req, res, next) => {
  try {
    const { data: admins, error: dbError } = await supabase
      .from('admin_users')
      .select(`
        *,
        users!admin_users_user_id_fkey(id, email, name, created_at)
      `)
      .order('created_at', { ascending: false });

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Admins retrieved', { admins }));
  } catch (err) {
    next(err);
  }
};

/**
 * Update admin permissions
 */
exports.updateAdminPermissions = async (req, res, next) => {
  try {
    const { adminId } = req.params;
    const { permissions, adminRole } = req.body;

    // Verify admin exists
    const { data: adminUser, error: checkError } = await supabase
      .from('admin_users')
      .select()
      .eq('id', adminId)
      .single();

    if (checkError || !adminUser) {
      return res.status(404).json(error('Admin not found'));
    }

    // Update permissions
    const { data: updated, error: dbError } = await supabase
      .from('admin_users')
      .update({
        permissions: permissions || adminUser.permissions,
        admin_role: adminRole || adminUser.admin_role,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'updated_admin_permissions',
      'admin_user',
      adminId,
      { permissions, adminRole },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Admin permissions updated', { admin: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * Remove admin status from user
 */
exports.removeAdmin = async (req, res, next) => {
  try {
    const { adminId } = req.params;

    // Verify admin exists
    const { data: adminUser, error: checkError } = await supabase
      .from('admin_users')
      .select('*, users!admin_users_user_id_fkey(email)')
      .eq('id', adminId)
      .single();

    if (checkError || !adminUser) {
      return res.status(404).json(error('Admin not found'));
    }

    // Delete admin record
    const { error: dbError } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', adminId);

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'removed_admin',
      'admin_user',
      adminId,
      { email: adminUser.users.email },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Admin removed successfully'));
  } catch (err) {
    next(err);
  }
};

// ── PROMO CODE MANAGEMENT ──────────────────────────────────

/**
 * Generate a random promo code
 */
function generatePromoCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 12);
}

/**
 * Create a new promo code
 */
exports.createPromoCode = async (req, res, next) => {
  try {
    const {
      code,
      description,
      discountPercent,
      discountAmount,
      discountType = 'percent',
      applicablePlans,
      maxUses,
      validFrom,
      expiresAt
    } = req.body;

    // Generate code if not provided
    const promoCode = code || generatePromoCode();

    // Check for existing code
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', promoCode)
      .single();

    if (existing) {
      return res.status(409).json(error('Promo code already exists'));
    }

    // Validate discount
    if (discountType === 'percent' && discountPercent > 100) {
      return res.status(400).json(error('Discount percent cannot exceed 100'));
    }

    // Normalize optional dates to null when empty
    const normalizeDate = (value) => {
      if (!value || value === '') return null;
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed)) return null;
      return new Date(parsed).toISOString();
    };

    const normalizedValidFrom = normalizeDate(validFrom);
    const normalizedExpiresAt = normalizeDate(expiresAt);

    // Create promo code
    const { data: newPromo, error: dbError } = await supabase
      .from('promo_codes')
      .insert({
        code: promoCode,
        description,
        discount_percent: discountType === 'percent' ? discountPercent : 0,
        fixed_amount: discountType === 'fixed' ? discountAmount : null,
        discount_type: discountType,
        applicable_plans: applicablePlans,
        max_uses: maxUses,
        valid_from: normalizedValidFrom,
        expires_at: normalizedExpiresAt,
        is_active: true,
        status: 'active',
        created_by: req.user.id
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'created_promo_code',
      'promo_code',
      newPromo.id,
      { code: promoCode, discount: discountPercent || discountAmount },
      req.ip,
      req.get('user-agent')
    );

    return res.status(201).json(success('Promo code created', { promoCode: newPromo }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get all promo codes with filtering
 */
exports.getPromoCodes = async (req, res, next) => {
  try {
    const { status, isActive, limit = 50, offset = 0 } = req.query;

    let query = supabase.from('promo_codes').select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (isActive !== undefined) query = query.eq('is_active', isActive === 'true');

    const { data: promoCodes, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Promo codes retrieved', {
      promoCodes,
      pagination: { count, limit, offset }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get single promo code with usage details
 */
exports.getPromoCodeDetail = async (req, res, next) => {
  try {
    const { codeId } = req.params;

    const { data: promoCode, error: codeError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('id', codeId)
      .single();

    if (codeError || !promoCode) {
      return res.status(404).json(error('Promo code not found'));
    }

    // Get usage details
    const { data: usages, error: usageError } = await supabase
      .from('promo_code_uses')
      .select('*, users(id, email, name)')
      .eq('promo_code_id', codeId)
      .order('created_at', { ascending: false });

    if (usageError) throw new Error(usageError.message);

    return res.json(success('Promo code details', {
      promoCode,
      usages,
      usageCount: usages?.length || 0
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Update promo code
 */
exports.updatePromoCode = async (req, res, next) => {
  try {
    const { codeId } = req.params;
    const {
      description,
      discountPercent,
      discountAmount,
      applicablePlans,
      maxUses,
      expiresAt,
      isActive,
      status
    } = req.body;

    // Verify promo exists
    const { data: promoCode, error: checkError } = await supabase
      .from('promo_codes')
      .select()
      .eq('id', codeId)
      .single();

    if (checkError || !promoCode) {
      return res.status(404).json(error('Promo code not found'));
    }

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (description !== undefined) updates.description = description;
    if (discountPercent !== undefined) updates.discount_percent = discountPercent;
    if (discountAmount !== undefined) updates.fixed_amount = discountAmount;
    if (applicablePlans !== undefined) updates.applicable_plans = applicablePlans;
    if (maxUses !== undefined) updates.max_uses = maxUses;
    if (expiresAt !== undefined) updates.expires_at = expiresAt;
    if (isActive !== undefined) updates.is_active = isActive;
    if (status !== undefined) updates.status = status;

    // Update promo code
    const { data: updated, error: dbError } = await supabase
      .from('promo_codes')
      .update(updates)
      .eq('id', codeId)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'updated_promo_code',
      'promo_code',
      codeId,
      updates,
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Promo code updated', { promoCode: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * Delete/Archive promo code
 */
exports.deletePromoCode = async (req, res, next) => {
  try {
    const { codeId } = req.params;

    // Verify promo exists
    const { data: promoCode, error: checkError } = await supabase
      .from('promo_codes')
      .select('code')
      .eq('id', codeId)
      .single();

    if (checkError || !promoCode) {
      return res.status(404).json(error('Promo code not found'));
    }

    // Archive instead of delete (soft delete)
    const { error: dbError } = await supabase
      .from('promo_codes')
      .update({ status: 'archived', is_active: false })
      .eq('id', codeId);

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'archived_promo_code',
      'promo_code',
      codeId,
      { code: promoCode.code },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Promo code archived'));
  } catch (err) {
    next(err);
  }
};

/**
 * Get admin activity logs
 */
exports.getActivityLogs = async (req, res, next) => {
  try {
    const { adminUserId, action, limit = 100, offset = 0 } = req.query;

    let query = supabase.from('admin_activity_logs').select(
      `*, admin_users(users!admin_users_user_id_fkey(email))`,
      { count: 'exact' }
    );

    if (adminUserId) query = query.eq('admin_user_id', adminUserId);
    if (action) query = query.eq('action', action);

    const { data: logs, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Activity logs retrieved', {
      logs,
      pagination: { count, limit, offset }
    }));
  } catch (err) {
    next(err);
  }
};

// ── USER MANAGEMENT ────────────────────────────────────────

/**
 * Get users with filters and pagination
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { status = 'all', plan, limit = 50, offset = 0, search } = req.query;

    let query = supabase.from('users').select('*, subscription_plans(*)', { count: 'exact' });

    // Apply filters
    if (status !== 'all') {
      if (status === 'active') {
        query = query.eq('is_verified', true);
      } else if (status === 'inactive') {
        query = query.eq('is_verified', false);
      }
    }

    if (plan) {
      query = query.eq('plan_id', plan);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Users retrieved', {
      users,
      pagination: { count, limit, offset }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get subscriptions with filters
 */
exports.getSubscriptions = async (req, res, next) => {
  try {
    const { status = 'active', plan, limit = 50, offset = 0 } = req.query;

    let query = supabase.from('users').select(`
      id, email, name, subscription_status, billing_cycle,
      subscription_expires_at, subscription_plans(*), plan_id
    `, { count: 'exact' });

    // Filter by status
    query = query.eq('subscription_status', status);

    if (plan) {
      query = query.eq('plan_id', plan);
    }

    const { data: subscriptions, count, error: dbError } = await query
      .order('subscription_expires_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Subscriptions retrieved', {
      subscriptions,
      pagination: { count, limit, offset }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get push notifications
 */
exports.getPushNotifications = async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase.from('push_notifications').select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: notifications, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Push notifications retrieved', {
      notifications,
      pagination: { count, limit, offset }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Send push notification
 */
exports.sendPushNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      imageUrl,
      actionUrl,
      targetSegment = 'all',
      scheduledFor
    } = req.body;

    const normalizeDate = (value) => {
      if (!value || value === '') return null;
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed)) return null;
      return new Date(parsed).toISOString();
    };

    const normalizedScheduledFor = normalizeDate(scheduledFor);

    const { data: notification, error: dbError } = await supabase
      .from('push_notifications')
      .insert({
        admin_user_id: req.adminUser.id,
        title,
        message,
        image_url: imageUrl,
        action_url: actionUrl,
        target_segment: targetSegment,
        scheduled_for: normalizedScheduledFor,
        status: normalizedScheduledFor ? 'scheduled' : 'sent',
        sent_at: normalizedScheduledFor ? null : new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    await logAdminActivity(
      req.adminUser.id,
      'sent_notification',
      'push_notification',
      notification.id,
      { title, targetSegment },
      req.ip,
      req.get('user-agent')
    );

    return res.status(201).json(success('Notification created', { notification }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();
    const scopedUserId = req.isSuperAdmin ? null : req.user.id;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    let usersQuery = supabase
      .from('users')
      .select('id', { count: 'exact' });
    if (scopedUserId) usersQuery = usersQuery.eq('id', scopedUserId);
    const { count: totalUsers } = await usersQuery;

    let activeSubsQuery = supabase
      .from('users')
      .select('id, subscription_expires_at')
      .eq('subscription_status', 'active');
    if (scopedUserId) activeSubsQuery = activeSubsQuery.eq('id', scopedUserId);
    const { data: activeSubscriptionRows } = await activeSubsQuery;

    const activeSubscriptions = (activeSubscriptionRows || []).filter((u) => {
      return !u.subscription_expires_at || u.subscription_expires_at > nowIso;
    }).length;

    const paymentQuery = supabase
        .from('billing_transactions')
        .select('amount')
        .eq('type', 'payment')
        .eq('status', 'completed');

    const refundQuery = supabase
        .from('billing_transactions')
        .select('amount')
        .eq('type', 'refund')
        .eq('status', 'completed');

    if (scopedUserId) {
      paymentQuery.eq('user_id', scopedUserId);
      refundQuery.eq('user_id', scopedUserId);
    }

    const [{ data: payments }, { data: refunds }] = await Promise.all([paymentQuery, refundQuery]);

    const grossRevenue = (payments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalRefunds = (refunds || []).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const totalRevenue = grossRevenue - totalRefunds;

    let promosQuery = supabase
      .from('promo_codes')
      .select('id', { count: 'exact' })
      .eq('is_active', true);
    if (scopedUserId) promosQuery = promosQuery.eq('created_by', scopedUserId);
    const { count: activePromoCodes } = await promosQuery;

    return res.json(success('Dashboard stats retrieved', {
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      activePromoCodes,
      generated_at: nowIso
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get analytics data
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();
    const scopedUserId = req.isSuperAdmin ? null : req.user.id;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { range = '30d' } = req.query;

    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
      case '30d':
      default:
        startDate.setDate(now.getDate() - 30);
    }

    let totalUsersQuery = supabase
      .from('users')
      .select('id', { count: 'exact' });
    if (scopedUserId) totalUsersQuery = totalUsersQuery.eq('id', scopedUserId);
    const { count: totalUsers } = await totalUsersQuery;

    let newSignupsQuery = supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString());
    if (scopedUserId) newSignupsQuery = newSignupsQuery.eq('id', scopedUserId);
    const { count: newSignups } = await newSignupsQuery;

    let activeRowsQuery = supabase
      .from('users')
      .select('id, subscription_expires_at')
      .eq('subscription_status', 'active');
    if (scopedUserId) activeRowsQuery = activeRowsQuery.eq('id', scopedUserId);
    const { data: activeSubscriptionRows } = await activeRowsQuery;

    const activeSubscriptions = (activeSubscriptionRows || []).filter((u) => {
      return !u.subscription_expires_at || u.subscription_expires_at > nowIso;
    }).length;

    const paymentQuery = supabase
        .from('billing_transactions')
        .select('amount')
        .eq('type', 'payment')
        .eq('status', 'completed')
        .gte('transaction_date', startDate.toISOString());
    const refundQuery = supabase
        .from('billing_transactions')
        .select('amount')
        .eq('type', 'refund')
        .eq('status', 'completed')
        .gte('transaction_date', startDate.toISOString());

    if (scopedUserId) {
      paymentQuery.eq('user_id', scopedUserId);
      refundQuery.eq('user_id', scopedUserId);
    }

    const [{ data: payments }, { data: refunds }] = await Promise.all([paymentQuery, refundQuery]);

    const grossRevenue = (payments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalRefunds = (refunds || []).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const totalRevenue = grossRevenue - totalRefunds;

    return res.json(success('Analytics retrieved', {
      totalUsers,
      newSignups,
      activeSubscriptions,
      totalRevenue,
      dateRange: range,
      generated_at: nowIso
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Verify admin access
 */
exports.verifyAdmin = async (req, res, next) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json(error('Not an admin'));
    }

    return res.json(success('Admin verified', {
      isAdmin: true,
      isSuperAdmin: req.isSuperAdmin,
      adminRole: req.adminUser.admin_role,
      permissions: getEffectivePermissions(req.adminUser),
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      }
    }));
  } catch (err) {
    next(err);
  }
};
