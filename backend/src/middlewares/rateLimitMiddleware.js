const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const tierCache = new Map();
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getUserTier(userId) {
  const cached = tierCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tier;

  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_expires_at, subscription_plans(name)')
      .eq('id', userId)
      .single();

    if (!user) return 'free';

    const isActive = user.subscription_status === 'active' &&
      (!user.subscription_expires_at || new Date(user.subscription_expires_at) > new Date());

    const tier = isActive ? (user.subscription_plans?.name || 'free') : 'free';
    tierCache.set(userId, { tier, ts: Date.now() });
    return tier;
  } catch {
    return 'free';
  }
}

async function getRateConfig(tier, feature) {
  const key = `${tier}:${feature}`;
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.config;

  try {
    const { data } = await supabase
      .from('rate_limit_config')
      .select('max_uses_per_day, max_uses_per_week, max_uses_per_month')
      .eq('tier', tier)
      .eq('feature', feature)
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      configCache.set(key, { config: data, ts: Date.now() });
    }
    return data;
  } catch {
    return null;
  }
}

async function getUsageCounts(userId, feature) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    const { data: usages } = await supabase
      .from('rate_limit_usage')
      .select('used_at')
      .eq('user_id', userId)
      .eq('feature', feature)
      .gte('used_at', monthStart);

    const all = usages || [];
    return {
      daily: all.filter(u => u.used_at >= dayStart).length,
      weekly: all.filter(u => u.used_at >= weekStart).length,
      monthly: all.length
    };
  } catch {
    return { daily: 0, weekly: 0, monthly: 0 };
  }
}

async function recordUsage(userId, feature, metadata = {}) {
  try {
    await supabase.from('rate_limit_usage').insert({
      user_id: userId,
      feature,
      metadata
    });
  } catch (err) {
    logger.warn('Failed to record rate limit usage:', err.message);
  }
}

function rateLimit(feature) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const tier = await getUserTier(userId);
    const config = await getRateConfig(tier, feature);

    if (!config) return next();

    const usage = await getUsageCounts(userId, feature);

    const exceeded =
      (config.max_uses_per_day && usage.daily >= config.max_uses_per_day) ||
      (config.max_uses_per_week && usage.weekly >= config.max_uses_per_week) ||
      (config.max_uses_per_month && usage.monthly >= config.max_uses_per_month);

    if (exceeded) {
      let limitType = 'daily';
      let limit = config.max_uses_per_day;
      if (config.max_uses_per_month && usage.monthly >= config.max_uses_per_month) {
        limitType = 'monthly';
        limit = config.max_uses_per_month;
      } else if (config.max_uses_per_week && usage.weekly >= config.max_uses_per_week) {
        limitType = 'weekly';
        limit = config.max_uses_per_week;
      }

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You've reached your ${limitType} limit for this feature (${tier} tier). Upgrade your plan for higher limits.`,
        code: 'RATE_LIMIT_EXCEEDED',
        feature,
        tier,
        limitType,
        limit,
        current: usage[limitType],
        upgradeUrl: '/subscription'
      });
    }

    req.rateLimitInfo = { tier, usage, config };
    next();
  };
}

function getRemainingUsage(tier, feature, usage) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const userTier = tier || await getUserTier(userId);
    const config = await getRateConfig(userTier, feature);
    const usageCounts = usage || await getUsageCounts(userId, feature);

    req.remainingUsage = {
      daily: config?.max_uses_per_day ? config.max_uses_per_day - usageCounts.daily : null,
      weekly: config?.max_uses_per_week ? config.max_uses_per_week - usageCounts.weekly : null,
      monthly: config?.max_uses_per_month ? config.max_uses_per_month - usageCounts.monthly : null,
      tier: userTier
    };
    next();
  };
}

module.exports = { rateLimit, recordUsage, getUserTier, getUsageCounts, getRemainingUsage };
