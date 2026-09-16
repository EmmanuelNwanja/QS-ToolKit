const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const featureFlagService = require('../services/featureFlagService');

exports.list = async (req, res, next) => {
  try {
    const { data: flags, count } = await supabase
      .from('feature_flags')
      .select('*', { count: 'exact' })
      .order('feature_key');

    return res.json(success('Feature flags', { flags, total: count }));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { feature_key, enabled_globally, enabled_for_plans, enabled_for_users, rollout_percentage, environment, description } = req.body;

    if (!feature_key) {
      return res.status(400).json(error('feature_key is required'));
    }

    const { data, error: createErr } = await supabase
      .from('feature_flags')
      .insert({
        feature_key,
        name: req.body.name || feature_key,
        enabled_globally: enabled_globally ?? false,
        enabled_for_plans: enabled_for_plans ?? [],
        enabled_for_users: enabled_for_users ?? [],
        rollout_percentage: rollout_percentage ?? 100,
        environment: environment ?? 'all',
        description,
      })
      .select()
      .single();

    if (createErr) {
      if (createErr.code === '23505') {
        return res.status(409).json(error('Feature flag already exists'));
      }
      throw createErr;
    }

    featureFlagService.clearCache();
    return res.json(success('Feature flag created', { flag: data }));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    const allowed = ['enabled_globally', 'enabled_for_plans', 'enabled_for_users', 'rollout_percentage', 'environment', 'description', 'is_enabled'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error: updateErr } = await supabase
      .from('feature_flags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    featureFlagService.clearCache();
    return res.json(success('Feature flag updated', { flag: data }));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error: delErr } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;
    featureFlagService.clearCache();
    return res.json(success('Feature flag deleted'));
  } catch (err) { next(err); }
};

exports.getEnabled = async (req, res, next) => {
  try {
    const flags = await featureFlagService.getAllFlagsForUser(req.user);
    return res.json(success('Enabled flags', { flags }));
  } catch (err) { next(err); }
};
