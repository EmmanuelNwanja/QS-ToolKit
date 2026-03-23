// controllers/leaderboardController.js
const supabase = require('../config/supabase');
const { success } = require('../utils/responseHelper');

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { sort = 'rank_by_projects', limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const validSorts = ['rank_by_projects', 'rank_by_rating', 'total_projects', 'avg_rating', 'total_project_value'];
    const sortField = validSorts.includes(sort) ? sort : 'rank_by_projects';

    const { data, count, error: err } = await supabase
      .from('leaderboard')
      .select('*', { count: 'exact' })
      .order(sortField, { ascending: true })
      .range(offset, offset + limit - 1);

    if (err) throw err;

    // My position if authenticated
    return res.json(success('Leaderboard', {
      leaderboard: data,
      pagination: { total: count, page: +page, limit: +limit }
    }));
  } catch (err) { next(err); }
};

exports.getMyRank = async (req, res, next) => {
  try {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    return res.json(success('My rank', { rank: data }));
  } catch (err) { next(err); }
};
