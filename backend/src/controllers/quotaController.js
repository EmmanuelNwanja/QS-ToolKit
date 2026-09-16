const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const { getUserTier, getUsageCounts, clearTierCache } = require('../middlewares/rateLimitMiddleware');

exports.getUsageOverview = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, feature, tier } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('rate_limit_usage')
      .select('user_id, feature, used_at, users(name, email, subscription_status)', { count: 'exact' });

    if (feature) query = query.eq('feature', feature);

    const { data: usages, count } = await query
      .order('used_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aggregate by user
    const userUsage = {};
    (usages || []).forEach(u => {
      if (!userUsage[u.user_id]) {
        userUsage[u.user_id] = {
          user_id: u.user_id,
          name: u.users?.name,
          email: u.users?.email,
          features: {}
        };
      }
      if (!userUsage[u.user_id].features[u.feature]) {
        userUsage[u.user_id].features[u.feature] = 0;
      }
      userUsage[u.user_id].features[u.feature]++;
    });

    return res.json(success('Usage overview', {
      users: Object.values(userUsage),
      pagination: { page: Number(page), limit: Number(limit), total: count }
    }));
  } catch (err) { next(err); }
};

exports.getUserUsage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const tier = await getUserTier(userId);
    const usage = await getUsageCounts(userId, 'ai_chat');

    // Get all features for this user
    const { data: features } = await supabase
      .from('rate_limit_usage')
      .select('feature')
      .eq('user_id', userId)
      .gte('used_at', new Date(new Date().setDate(1)).toISOString());

    const featureCounts = {};
    (features || []).forEach(f => {
      featureCounts[f.feature] = (featureCounts[f.feature] || 0) + 1;
    });

    return res.json(success('User usage', { userId, tier, features: featureCounts }));
  } catch (err) { next(err); }
};

exports.getConfig = async (req, res, next) => {
  try {
    const { data: configs, error: fetchErr } = await supabase
      .from('rate_limit_config')
      .select('*')
      .order('tier');

    if (fetchErr) throw fetchErr;
    return res.json(success('Rate limit configs', { configs }));
  } catch (err) { next(err); }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { max_uses_per_day, max_uses_per_week, max_uses_per_month, is_active } = req.body;

    const updates = {};
    if (max_uses_per_day !== undefined) updates.max_uses_per_day = max_uses_per_day;
    if (max_uses_per_week !== undefined) updates.max_uses_per_week = max_uses_per_week;
    if (max_uses_per_month !== undefined) updates.max_uses_per_month = max_uses_per_month;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error: updateErr } = await supabase
      .from('rate_limit_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    clearTierCache();
    return res.json(success('Config updated', { config: data }));
  } catch (err) { next(err); }
};

exports.createConfig = async (req, res, next) => {
  try {
    const { tier, feature, max_uses_per_day, max_uses_per_week, max_uses_per_month } = req.body;

    if (!tier || !feature) {
      return res.status(400).json(error('tier and feature are required'));
    }

    const { data, error: createErr } = await supabase
      .from('rate_limit_config')
      .insert({ tier, feature, max_uses_per_day, max_uses_per_week, max_uses_per_month })
      .select()
      .single();

    if (createErr) throw createErr;
    clearTierCache();
    return res.json(success('Config created', { config: data }));
  } catch (err) { next(err); }
};

exports.getFeatures = async (req, res, next) => {
  try {
    const { data } = await supabase
      .from('rate_limit_config')
      .select('feature')
      .eq('is_active', true);

    const features = [...new Set((data || []).map(d => d.feature))];
    return res.json(success('Features', { features }));
  } catch (err) { next(err); }
};
