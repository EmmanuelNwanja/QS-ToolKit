// controllers/leaderboardController.js
const supabase = require('../config/supabase');
const { success } = require('../utils/responseHelper');

// Throttle materialized-view refreshes to avoid heavy DB churn under load.
const LEADERBOARD_REFRESH_WINDOW_MS = 15000;
let lastLeaderboardRefreshAt = 0;

async function refreshLeaderboardIfStale(force = false) {
  const now = Date.now();
  if (!force && now - lastLeaderboardRefreshAt < LEADERBOARD_REFRESH_WINDOW_MS) {
    return;
  }

  const { error } = await supabase.rpc('refresh_leaderboard');
  if (!error) {
    lastLeaderboardRefreshAt = now;
  }
}

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { sort = 'rank_by_projects', limit = 50, page = 1, category, force_refresh } = req.query;
    const offset = (page - 1) * limit;

    // Ensure leaderboard reflects near-live project updates.
    await refreshLeaderboardIfStale(force_refresh === 'true');

    // Prevent intermediaries/browser from serving stale leaderboard payloads.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const validSorts = ['rank_by_projects', 'rank_by_rating', 'total_projects', 'avg_rating', 'total_project_value'];
    const sortField = validSorts.includes(sort) ? sort : 'rank_by_projects';

    let query = supabase
      .from('leaderboard')
      .select('*', { count: 'exact' })
      .order(sortField, { ascending: true })
      .range(offset, offset + limit - 1);

    // Category filter: student | professional | company
    if (category && category !== 'all') {
      query = query.eq('user_type', category);
    }

    const { data, count, error: err } = await query;

    if (err) throw err;

    return res.json(success('Leaderboard', {
      leaderboard: data,
      pagination: { total: count, page: +page, limit: +limit }
    }));
  } catch (err) { next(err); }
};

exports.getMyRank = async (req, res, next) => {
  try {
    await refreshLeaderboardIfStale(false);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    return res.json(success('My rank', { rank: data }));
  } catch (err) { next(err); }
};
