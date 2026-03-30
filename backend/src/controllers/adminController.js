const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { logAdminActivity } = require('../middlewares/adminMiddleware');
const { getEffectivePermissions, DEFAULT_ADMIN_PERMISSIONS } = require('../middlewares/adminMiddleware');
const crypto = require('crypto');
const pushService = require('../services/pushService');
const emailService = require('../services/emailService');

const ADMIN_OTP_TTL_MINUTES = 30;

function readTransactionNumber(transaction, field, fallback = 0) {
  if (transaction?.[field] !== undefined && transaction?.[field] !== null) {
    return Number(transaction[field]) || 0;
  }

  if (transaction?.metadata?.[field] !== undefined && transaction?.metadata?.[field] !== null) {
    return Number(transaction.metadata[field]) || 0;
  }

  return fallback;
}

function readTransactionText(transaction, field, fallback = null) {
  if (transaction?.[field] !== undefined && transaction?.[field] !== null && String(transaction[field]).trim()) {
    return String(transaction[field]).trim();
  }

  if (transaction?.metadata?.[field] !== undefined && transaction?.metadata?.[field] !== null && String(transaction.metadata[field]).trim()) {
    return String(transaction.metadata[field]).trim();
  }

  return fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getCycleAmount(plan, billingCycle) {
  if (!plan) return 0;

  if (billingCycle === 'annual') {
    if (plan.price_annual != null) {
      return Number(plan.price_annual) || 0;
    }
    return roundMoney((Number(plan.price_monthly) || 0) * 12 * 0.9);
  }

  return Number(plan.price_monthly) || 0;
}

function getMonthlyRecurringValue(plan, billingCycle) {
  if (!plan) return 0;
  if (billingCycle === 'annual') {
    const annual = getCycleAmount(plan, 'annual');
    return roundMoney(annual / 12);
  }
  return Number(plan.price_monthly) || 0;
}

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
        query = query.eq('is_verified', true).neq('subscription_status', 'suspended');
      } else if (status === 'inactive') {
        query = query.or('is_verified.eq.false,subscription_status.eq.inactive,subscription_status.eq.expired,subscription_status.eq.cancelled');
      } else if (status === 'suspended') {
        query = query.eq('subscription_status', 'suspended');
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
 * Generate an admin-issued one-time password for a user.
 */
exports.generateUserOneTimePassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const expiresInMinutesRaw = Number(req.body?.expiresInMinutes || ADMIN_OTP_TTL_MINUTES);
    const expiresInMinutes = Number.isFinite(expiresInMinutesRaw)
      ? Math.min(Math.max(Math.round(expiresInMinutesRaw), 5), 120)
      : ADMIN_OTP_TTL_MINUTES;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Revoke previous unused OTPs so only the latest one is active.
    await supabase
      .from('admin_password_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    const oneTimePassword = generateOneTimePassword();
    const otpHash = hashValue(oneTimePassword);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const { data: otpRecord, error: otpError } = await supabase
      .from('admin_password_otps')
      .insert({
        user_id: user.id,
        issued_by_admin_user_id: req.adminUser.id,
        otp_hash: otpHash,
        expires_at: expiresAt
      })
      .select('id, expires_at, created_at')
      .single();

    if (otpError) throw new Error(otpError.message);

    await logAdminActivity(
      req.adminUser.id,
      'generated_one_time_password',
      'user',
      user.id,
      {
        user_email: user.email,
        user_name: user.name,
        expires_at: expiresAt
      },
      req.ip,
      req.get('user-agent')
    );

    // Surface this security action in the admin notifications feed.
    await supabase.from('push_notifications').insert({
      admin_user_id: req.adminUser.id,
      title: 'One-time password created',
      message: `Temporary access code generated for ${user.email}`,
      target_segment: 'admins',
      status: 'sent',
      sent_at: new Date().toISOString(),
      total_recipients: 1,
      successful_sends: 1,
      failed_sends: 0
    });

    return res.status(201).json(success('One-time password created successfully', {
      oneTimePassword,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      otpRecord
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
    const { status = 'active', plan, search = '', dateFrom = null, dateTo = null, limit = 50, offset = 0 } = req.query;

    let query = supabase.from('users').select(`
      id, email, name, subscription_status, billing_cycle,
      subscription_expires_at, subscription_plans(*), plan_id
    `, { count: 'exact' });

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('subscription_status', status);
    }

    if (plan) {
      query = query.eq('plan_id', plan);
    }

    // Search by email or name (case-insensitive substring match)
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      // Using .or() for OR condition - search in email or name
      query = query.or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
    }

    // Filter by date range (subscription expiry date)
    if (dateFrom) {
      query = query.gte('subscription_expires_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      query = query.lte('subscription_expires_at', new Date(dateTo).toISOString());
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
 * Get Paystack plan-code mappings for subscription plans.
 */
exports.getPaystackPlanMappings = async (req, res, next) => {
  try {
    const { data: plans, error: dbError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly, price_annual, is_active, paystack_plan_code, paystack_plan_code_annual, created_at')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (dbError) {
      if (String(dbError.message || '').toLowerCase().includes('paystack_plan_code')) {
        return res.status(500).json(error('Paystack mapping columns are missing. Run migration 023_paystack_plan_mapping_and_annual_discount.sql.'));
      }
      throw new Error(dbError.message);
    }

    return res.json(success('Paystack plan mappings retrieved', { plans }));
  } catch (err) {
    next(err);
  }
};

/**
 * Update Paystack plan-code mappings for a subscription plan.
 */
exports.updatePaystackPlanMapping = async (req, res, next) => {
  try {
    const { planId } = req.params;

    const normalizeCode = (value) => {
      const normalized = String(value || '').trim();
      return normalized || null;
    };

    const monthlyCode = normalizeCode(req.body?.paystack_plan_code);
    const annualCode = normalizeCode(req.body?.paystack_plan_code_annual);

    const { data: currentPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly, paystack_plan_code, paystack_plan_code_annual')
      .eq('id', planId)
      .single();

    if (planError || !currentPlan) {
      return res.status(404).json(error('Subscription plan not found'));
    }

    if (Number(currentPlan.price_monthly || 0) > 0 && (!monthlyCode || !annualCode)) {
      return res.status(400).json(error('Both monthly and annual Paystack plan codes are required for paid plans'));
    }

    const submittedCodes = [monthlyCode, annualCode].filter(Boolean);
    if (new Set(submittedCodes).size !== submittedCodes.length) {
      return res.status(400).json(error('Monthly and annual Paystack plan codes must be different'));
    }

    if (submittedCodes.length > 0) {
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id, name, paystack_plan_code, paystack_plan_code_annual')
        .eq('is_active', true);

      const conflictingPlan = (plans || []).find((plan) => (
        plan.id !== planId && submittedCodes.some((code) => (
          code === plan.paystack_plan_code || code === plan.paystack_plan_code_annual
        ))
      ));

      if (conflictingPlan) {
        return res.status(409).json(error(`A submitted Paystack plan code is already assigned to ${conflictingPlan.name}`));
      }
    }

    const updates = {
      paystack_plan_code: monthlyCode,
      paystack_plan_code_annual: annualCode
    };

    const { data: updatedPlan, error: updateError } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', planId)
      .select('id, name, price_monthly, price_annual, is_active, paystack_plan_code, paystack_plan_code_annual, created_at')
      .single();

    if (updateError) {
      if (String(updateError.message || '').toLowerCase().includes('paystack_plan_code')) {
        return res.status(500).json(error('Paystack mapping columns are missing. Run migration 023_paystack_plan_mapping_and_annual_discount.sql.'));
      }
      throw new Error(updateError.message);
    }

    await logAdminActivity(
      req.adminUser.id,
      'updated_paystack_plan_mapping',
      'subscription_plan',
      planId,
      {
        plan_name: updatedPlan.name,
        paystack_plan_code: updatedPlan.paystack_plan_code,
        paystack_plan_code_annual: updatedPlan.paystack_plan_code_annual
      },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Paystack plan mapping updated', { plan: updatedPlan }));
  } catch (err) {
    next(err);
  }
};

function generateOneTimePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let otp = '';
  for (let index = 0; index < 8; index += 1) {
    const randomByte = crypto.randomBytes(1)[0];
    otp += alphabet[randomByte % alphabet.length];
  }
  return otp;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

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

    // Dispatch web push to subscribed users immediately (skip for scheduled)
    if (!normalizedScheduledFor) {
      pushService.sendToSegment(targetSegment, notification).catch((err) =>
        logger.error('Background push delivery failed:', err)
      );
    }

    return res.status(201).json(success('Notification created', { notification }));
  } catch (err) {
    next(err);
  }
};

/**
 * Send a test transactional email (admin only)
 */
exports.sendTestEmail = async (req, res, next) => {
  try {
    const { to, subject, note } = req.body || {};

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json(error('Valid recipient email (to) is required'));
    }

    const delivered = await emailService.sendAdminTestEmail({
      to,
      subject,
      note,
      adminName: req.adminUser?.email || 'Admin'
    });

    await logAdminActivity(
      req.adminUser.id,
      'sent_test_email',
      'email_test',
      null,
      { to, delivered },
      req.ip,
      req.get('user-agent')
    );

    if (!delivered) {
      return res.status(502).json(error('Test email dispatch failed. Check provider credentials and logs.'));
    }

    return res.json(success('Test email sent successfully', { delivered: true, to }));
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
    const now = new Date();
    const next30Days = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    let usersQuery = supabase
      .from('users')
      .select('id', { count: 'exact' });
    const { count: totalUsers } = await usersQuery;

    let activeSubsQuery = supabase
      .from('users')
      .select('id, subscription_expires_at, billing_cycle, plan_id, subscription_plans(name, price_monthly, price_annual)')
      .eq('subscription_status', 'active')
      .not('plan_id', 'is', null);
    const { data: activeSubscriptionRows } = await activeSubsQuery;

    const activeSubscribers = (activeSubscriptionRows || []).filter((u) => {
      return !u.subscription_expires_at || u.subscription_expires_at > nowIso;
    });
    const activeSubscriptions = activeSubscribers.length;

    const paymentQuery = supabase
        .from('billing_transactions')
        .select('id, user_id, amount, currency, paystack_reference, description, transaction_date, created_at, metadata, users(name, email)')
        .eq('type', 'payment')
        .eq('status', 'completed');

    const refundQuery = supabase
        .from('billing_transactions')
        .select('amount, metadata')
        .eq('type', 'refund')
        .eq('status', 'completed');

    const [{ data: payments }, { data: refunds }] = await Promise.all([paymentQuery, refundQuery]);

    const grossRevenue = (payments || []).reduce((sum, row) => {
      const netAmount = readTransactionNumber(row, 'net_amount', Number(row.amount || 0));
      const discountAmount = readTransactionNumber(row, 'discount_amount', readTransactionNumber(row, 'discount_applied', 0));
      const grossAmount = readTransactionNumber(row, 'gross_amount', netAmount + discountAmount);
      return sum + grossAmount;
    }, 0);
    const collectedRevenue = (payments || []).reduce((sum, row) => {
      return sum + readTransactionNumber(row, 'net_amount', Number(row.amount || 0));
    }, 0);
    const totalDiscounts = (payments || []).reduce((sum, row) => {
      return sum + readTransactionNumber(row, 'discount_amount', readTransactionNumber(row, 'discount_applied', 0));
    }, 0);
    const totalRefunds = (refunds || []).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const totalRevenue = collectedRevenue - totalRefunds;
    const discountedPayments = (payments || []).filter((row) => {
      return readTransactionNumber(row, 'discount_amount', readTransactionNumber(row, 'discount_applied', 0)) > 0;
    });

    const planPerformanceMap = {};
    for (const payment of (payments || [])) {
      const planName = readTransactionText(payment, 'plan_name', 'unknown');
      const grossAmount = readTransactionNumber(payment, 'gross_amount', Number(payment.amount || 0));
      const discountAmount = readTransactionNumber(payment, 'discount_amount', readTransactionNumber(payment, 'discount_applied', 0));
      const netAmount = readTransactionNumber(payment, 'net_amount', Number(payment.amount || 0));

      if (!planPerformanceMap[planName]) {
        planPerformanceMap[planName] = {
          plan_name: planName,
          transactions: 0,
          gross_revenue: 0,
          discounted_revenue: 0,
          actual_revenue: 0,
          active_subscribers: 0,
          projected_monthly_revenue: 0
        };
      }

      planPerformanceMap[planName].transactions += 1;
      planPerformanceMap[planName].gross_revenue += grossAmount;
      planPerformanceMap[planName].discounted_revenue += discountAmount;
      planPerformanceMap[planName].actual_revenue += netAmount;
    }

    let monthlyRecurringRevenue = 0;
    let annualRecurringRevenue = 0;
    let next30DayProjection = 0;

    for (const subscriber of activeSubscribers) {
      const plan = subscriber.subscription_plans;
      if (!plan || Number(plan.price_monthly || 0) <= 0) continue;

      const planName = plan.name || 'unknown';
      const billingCycle = subscriber.billing_cycle || 'monthly';
      const monthlyValue = getMonthlyRecurringValue(plan, billingCycle);
      const cycleValue = getCycleAmount(plan, billingCycle);

      monthlyRecurringRevenue += monthlyValue;

      if (!planPerformanceMap[planName]) {
        planPerformanceMap[planName] = {
          plan_name: planName,
          transactions: 0,
          gross_revenue: 0,
          discounted_revenue: 0,
          actual_revenue: 0,
          active_subscribers: 0,
          projected_monthly_revenue: 0
        };
      }

      planPerformanceMap[planName].active_subscribers += 1;
      planPerformanceMap[planName].projected_monthly_revenue += monthlyValue;

      if (subscriber.subscription_expires_at) {
        const expiry = new Date(subscriber.subscription_expires_at);
        if (expiry >= now && expiry <= next30Days) {
          next30DayProjection += cycleValue;
        }
      }
    }

    annualRecurringRevenue = roundMoney(monthlyRecurringRevenue * 12);

    const recentTransactions = (payments || [])
      .slice()
      .sort((a, b) => new Date(b.transaction_date || b.created_at) - new Date(a.transaction_date || a.created_at))
      .slice(0, 10)
      .map((payment) => {
        const netAmount = readTransactionNumber(payment, 'net_amount', Number(payment.amount || 0));
        const discountAmount = readTransactionNumber(payment, 'discount_amount', readTransactionNumber(payment, 'discount_applied', 0));
        const grossAmount = readTransactionNumber(payment, 'gross_amount', netAmount + discountAmount);

        return {
          id: payment.id,
          customer_name: payment.users?.name || 'Unknown customer',
          customer_email: payment.users?.email || null,
          plan_name: readTransactionText(payment, 'plan_name', 'unknown'),
          billing_cycle: readTransactionText(payment, 'billing_cycle', 'monthly'),
          gross_amount: roundMoney(grossAmount),
          discount_amount: roundMoney(discountAmount),
          net_amount: roundMoney(netAmount),
          paystack_reference: payment.paystack_reference,
          transaction_date: payment.transaction_date || payment.created_at,
          payment_mode: readTransactionText(payment, 'payment_mode', 'subscription')
        };
      });

    const planPerformance = Object.values(planPerformanceMap)
      .map((planStats) => ({
        ...planStats,
        gross_revenue: roundMoney(planStats.gross_revenue),
        discounted_revenue: roundMoney(planStats.discounted_revenue),
        actual_revenue: roundMoney(planStats.actual_revenue),
        projected_monthly_revenue: roundMoney(planStats.projected_monthly_revenue)
      }))
      .sort((a, b) => b.actual_revenue - a.actual_revenue || b.projected_monthly_revenue - a.projected_monthly_revenue);

    let promosQuery = supabase
      .from('promo_codes')
      .select('id', { count: 'exact' })
      .eq('is_active', true);
    const { count: activePromoCodes } = await promosQuery;

    return res.json(success('Dashboard stats retrieved', {
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      activePromoCodes,
      financialModel: {
        grossSubscriptionValue: roundMoney(grossRevenue),
        discountedPaymentsValue: roundMoney(totalDiscounts),
        collectedRevenue: roundMoney(collectedRevenue),
        refundedRevenue: roundMoney(totalRefunds),
        actualRevenue: roundMoney(totalRevenue),
        discountedTransactionsCount: discountedPayments.length,
        discountedCollections: roundMoney(discountedPayments.reduce((sum, row) => {
          return sum + readTransactionNumber(row, 'net_amount', Number(row.amount || 0));
        }, 0)),
        averageTransactionValue: roundMoney((payments || []).length > 0 ? collectedRevenue / payments.length : 0),
        revenueRealizationRate: grossRevenue > 0 ? roundMoney((collectedRevenue / grossRevenue) * 100) : 100,
        monthlyRecurringRevenue: roundMoney(monthlyRecurringRevenue),
        annualRecurringRevenue,
        next30DayProjection: roundMoney(next30DayProjection),
        activePaidSubscribers: activeSubscribers.filter((u) => Number(u.subscription_plans?.price_monthly || 0) > 0).length,
        planPerformance,
        recentTransactions
      },
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
    const { count: totalUsers } = await totalUsersQuery;

    let newSignupsQuery = supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString());
    const { count: newSignups } = await newSignupsQuery;

    let activeRowsQuery = supabase
      .from('users')
      .select('id, subscription_expires_at')
      .eq('subscription_status', 'active');
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
