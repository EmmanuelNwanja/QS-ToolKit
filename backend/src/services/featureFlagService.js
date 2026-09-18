const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { environment } = require('../config/environment');

const flagCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getAllFlags() {
  const cached = flagCache.get('__all__');
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.flags;

  try {
    const { data: flags } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('enabled_globally', true);

    const result = flags || [];
    flagCache.set('__all__', { flags: result, ts: Date.now() });
    return result;
  } catch (err) {
    logger.error('[FeatureFlags] Failed to fetch flags:', err.message);
    return [];
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function evaluateRollout(flag, userId) {
  if (flag.rollout_percentage === 100) return true;
  if (flag.rollout_percentage === 0) return false;

  const hash = hashString(`${flag.feature_key}:${userId}`);
  const rollout = flag.rollout_percentage ?? flag.rollout_percent ?? 100;
  return (hash % 100) < rollout;
}

function isEnvironmentMatch(flag) {
  if (flag.environment === 'all') return true;
  return flag.environment === environment;
}

async function isEnabled(featureKey, user) {
  const flags = await getAllFlags();
  const flag = flags.find(f => f.feature_key === featureKey);

  if (!flag) return false;
  if (!isEnvironmentMatch(flag)) return false;

  // enabled_globally=false = kill switch (feature disabled for everyone)
  if (!flag.enabled_globally) return false;

  // No plan/user restrictions = open to all authenticated users
  const hasUserRestrictions = flag.enabled_for_users?.length > 0;
  const hasPlanRestrictions = flag.enabled_for_plans?.length > 0;
  if (!hasUserRestrictions && !hasPlanRestrictions) return true;

  // Admin bypass
  if (user?.is_admin) return true;

  // Per-user check
  if (hasUserRestrictions) {
    return flag.enabled_for_users.includes(user?.id);
  }

  // Plan-based check
  if (hasPlanRestrictions) {
    const userPlan = (user?.subscription_plan || 'free').toLowerCase();
    return flag.enabled_for_plans.includes(userPlan);
  }

  // Percentage rollout
  if (!user?.id) return false;
  return evaluateRollout(flag, user.id);
}

async function getAllFlagsForUser(user) {
  const flags = await getAllFlags();
  const result = {};

  for (const flag of flags) {
    if (!isEnvironmentMatch(flag)) continue;
    if (!flag.enabled_globally) { result[flag.feature_key] = false; continue; }

    const hasUserRestrictions = flag.enabled_for_users?.length > 0;
    const hasPlanRestrictions = flag.enabled_for_plans?.length > 0;

    if (!hasUserRestrictions && !hasPlanRestrictions) {
      result[flag.feature_key] = true;
    } else if (user?.is_admin) {
      result[flag.feature_key] = true;
    } else if (hasUserRestrictions) {
      result[flag.feature_key] = flag.enabled_for_users.includes(user?.id);
    } else if (hasPlanRestrictions) {
      const userPlan = (user?.subscription_plan || 'free').toLowerCase();
      result[flag.feature_key] = flag.enabled_for_plans.includes(userPlan);
    } else {
      result[flag.feature_key] = evaluateRollout(flag, user?.id);
    }
  }

  return result;
}

function clearCache() {
  flagCache.clear();
}

module.exports = { isEnabled, getAllFlags, getAllFlagsForUser, clearCache };
