const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

function generateCode() {
  return require('crypto').randomBytes(4).toString('hex').toUpperCase();
}

// ─── User-facing endpoints ────────────────────────────────────

exports.getMyLink = async (req, res, next) => {
  try {
    let { data, error: err } = await supabase
      .from('referral_links')
      .select('code, created_at')
      .eq('user_id', req.user.id)
      .single();

    // Create-on-miss: if no row exists, generate one
    if (err || !data) {
      const code = generateCode();
      const { data: created, error: insErr } = await supabase
        .from('referral_links')
        .insert({ user_id: req.user.id, code })
        .select('code, created_at')
        .single();

      if (insErr) {
        logger.warn({ message: 'Failed to create referral link', user_id: req.user.id, error: insErr.message });
        return res.status(500).json(error('Could not create referral link'));
      }
      data = created;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qs.solnuv.com';
    return res.json(success('Referral link', {
      code: data.code,
      link: `${baseUrl}/register?ref=${data.code}`,
      created_at: data.created_at
    }));
  } catch (err) { next(err); }
};

exports.getMyStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { count: totalSignups } = await supabase
      .from('referral_signups')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_user_id', userId);

    const { count: conversions } = await supabase
      .from('referral_signups')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_user_id', userId)
      .eq('discount_applied', true);

    return res.json(success('Referral stats', {
      stats: { total_signups: totalSignups || 0, conversions: conversions || 0 }
    }));
  } catch (err) { next(err); }
};

// ─── Admin endpoints ──────────────────────────────────────────

exports.adminAssignDiscount = async (req, res, next) => {
  try {
    const { user_id, discount_percent } = req.body;

    if (!user_id || !discount_percent) {
      return res.status(400).json(error('user_id and discount_percent are required'));
    }

    if (discount_percent <= 0 || discount_percent > 100) {
      return res.status(400).json(error('discount_percent must be between 0 and 100'));
    }

    // Verify target user exists
    const { data: targetUser } = await supabase
      .from('users').select('id').eq('id', user_id).single();

    if (!targetUser) return res.status(404).json(error('User not found'));

    // Deactivate any existing discount for this user
    await supabase
      .from('referral_discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('referrer_user_id', user_id)
      .eq('is_active', true);

    // Create new discount
    const { data, error: err } = await supabase
      .from('referral_discounts')
      .insert({
        referrer_user_id: user_id,
        discount_percent,
        assigned_by: req.user.id
      })
      .select()
      .single();

    if (err) throw err;
    return res.status(201).json(success('Referral discount assigned', { discount: data }));
  } catch (err) { next(err); }
};

exports.adminUpdateDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { discount_percent, is_active } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (discount_percent !== undefined) {
      if (discount_percent <= 0 || discount_percent > 100) {
        return res.status(400).json(error('discount_percent must be between 0 and 100'));
      }
      updates.discount_percent = discount_percent;
    }
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error: err } = await supabase
      .from('referral_discounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (err) throw err;
    if (!data) return res.status(404).json(error('Discount not found'));
    return res.json(success('Discount updated', { discount: data }));
  } catch (err) { next(err); }
};

exports.adminRevokeDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error: err } = await supabase
      .from('referral_discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (err) throw err;
    if (!data) return res.status(404).json(error('Discount not found'));
    return res.json(success('Discount revoked'));
  } catch (err) { next(err); }
};

exports.adminListDiscounts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data, count, error: err } = await supabase
      .from('referral_discounts')
      .select('*, users!referrer_user_id(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (err) throw err;
    return res.json(success('Referral discounts', {
      discounts: data,
      pagination: { total: count, page: +page, limit: +limit }
    }));
  } catch (err) { next(err); }
};

exports.adminGetReferralStats = async (req, res, next) => {
  try {
    const [{ count: totalSignups }, { count: totalConversions }, { data: topReferrers }] = await Promise.all([
      supabase.from('referral_signups').select('*', { count: 'exact', head: true }),
      supabase.from('referral_signups').select('*', { count: 'exact', head: true }).eq('discount_applied', true),
      supabase.rpc('get_top_referrers', {}).then(({ data }) => data).catch(() => [])
    ]);

    return res.json(success('Referral platform stats', {
      stats: {
        total_signups: totalSignups || 0,
        total_conversions: totalConversions || 0,
        conversion_rate: totalSignups ? ((totalConversions / totalSignups) * 100).toFixed(1) : '0',
        top_referrers: topReferrers || []
      }
    }));
  } catch (err) { next(err); }
};

// ─── Lookup used by auth/subscription ─────────────────────────

exports.lookupReferralCode = async (code) => {
  const { data } = await supabase
    .from('referral_links')
    .select('user_id')
    .eq('code', code)
    .single();
  return data?.user_id || null;
};

exports.getReferralDiscount = async (referrerUserId) => {
  const { data } = await supabase
    .from('referral_discounts')
    .select('id, discount_percent')
    .eq('referrer_user_id', referrerUserId)
    .eq('is_active', true)
    .single();
  return data || null;
};

exports.recordReferralSignup = async (referrerUserId, referredUserId) => {
  const { error } = await supabase
    .from('referral_signups')
    .insert({
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId
    });
  if (error) logger.warn('Failed to record referral signup:', error.message);
};

exports.markDiscountUsed = async (referredUserId) => {
  const { error } = await supabase
    .from('referral_signups')
    .update({ discount_applied: true, discount_used_at: new Date().toISOString() })
    .eq('referred_user_id', referredUserId)
    .eq('discount_applied', false);
  if (error) logger.warn('Failed to mark referral discount used:', error.message);
};

exports.getReferralInfoForUser = async (userId) => {
  const { data } = await supabase
    .from('users')
    .select('referred_by, created_at')
    .eq('id', userId)
    .single();
  return data;
};
