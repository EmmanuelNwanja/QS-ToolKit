const supabase = require('../config/supabase');
const { error } = require('../utils/responseHelper');

// Checks active subscription
exports.requireSubscription = (planLevel = 'student') => async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_expires_at, subscription_plans(name)')
      .eq('id', req.user.id)
      .single();

    if (user.subscription_status !== 'active') {
      return res.status(402).json(error('Active subscription required', { code: 'SUBSCRIPTION_REQUIRED' }));
    }

    const plan = user.subscription_plans?.name;
    const hierarchy = ['free', 'student', 'pro', 'enterprise'];
    if (hierarchy.indexOf(plan) < hierarchy.indexOf(planLevel)) {
      return res.status(402).json(error(`This feature requires ${planLevel} plan or higher`, { code: 'PLAN_UPGRADE_REQUIRED', required: planLevel }));
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Checks monthly calculator usage
exports.checkCalculatorLimit = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, subscription_status, subscription_plans(max_calculator_uses, name)')
      .eq('id', req.user.id)
      .single();

    const plan = user.subscription_plans;
    
    // Unlimited
    if (plan?.max_calculator_uses === null) return next();

    // Count this month's usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('calculator_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .gte('used_at', startOfMonth.toISOString());

    if (count >= (plan?.max_calculator_uses || 0)) {
      return res.status(402).json(error(
        `Monthly calculator limit reached (${plan?.max_calculator_uses} uses/month on ${plan?.name} plan)`,
        { code: 'CALCULATOR_LIMIT_REACHED', used: count, limit: plan?.max_calculator_uses }
      ));
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Checks project logging limit
exports.checkProjectLimit = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_plans(max_projects)')
      .eq('id', req.user.id)
      .single();

    const maxProjects = user.subscription_plans?.max_projects;
    if (maxProjects === null) return next();

    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (count >= maxProjects) {
      return res.status(402).json(error(
        `Project limit reached (${maxProjects} projects on your plan)`,
        { code: 'PROJECT_LIMIT_REACHED', limit: maxProjects }
      ));
    }
    next();
  } catch (err) {
    next(err);
  }
};
