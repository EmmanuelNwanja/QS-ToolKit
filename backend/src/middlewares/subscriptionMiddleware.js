const supabase = require('../config/supabase');
const { error } = require('../utils/responseHelper');

// New users with no active plan get this many LIFETIME calculator uses free
const FREE_TIER_USES = 3;

function normalizePlanName(planName) {
  return planName === 'student' ? 'basic' : planName;
}

function getDefaultBoqLimit(planName) {
  const plan = normalizePlanName(planName);
  if (plan === 'basic') return 2;
  if (plan === 'pro') return 5;
  if (plan === 'enterprise') return 50;
  return 0;
}

function getDefaultInvoiceLimit(planName) {
  const plan = normalizePlanName(planName);
  if (plan === 'basic') return 2;
  if (plan === 'pro') return 5;
  if (plan === 'enterprise') return 50;
  return 0;
}

// ── Check calculator usage limit ──────────────────────────────
exports.checkCalculatorLimit = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, subscription_status, subscription_plans(max_calculator_uses, name)')
      .eq('id', req.user.id)
      .single();

    const plan = user?.subscription_plans;
    const isActiveSubscriber = user?.subscription_status === 'active' && plan;

    // ── Active subscriber ────────────────────────────────────────
    if (isActiveSubscriber) {
      // Enterprise: unlimited
      if (plan.max_calculator_uses === null) return next();

      // Count this calendar month only
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('calculator_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .gte('used_at', startOfMonth.toISOString());

      if (count >= plan.max_calculator_uses) {
        return res.status(402).json(error(
          `You have used all ${plan.max_calculator_uses} calculator runs for this month on your ${plan.name} plan. Upgrade or wait until next month.`,
          { code: 'CALCULATOR_LIMIT_REACHED', used: count, limit: plan.max_calculator_uses, plan: plan.name }
        ));
      }
      return next();
    }

    // ── No active plan: 3 lifetime free uses ─────────────────────
    const { count: lifetimeCount } = await supabase
      .from('calculator_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (lifetimeCount >= FREE_TIER_USES) {
      return res.status(402).json(error(
        `You have used your ${FREE_TIER_USES} free calculator runs. Subscribe to continue.`,
        { code: 'FREE_TIER_EXHAUSTED', used: lifetimeCount, limit: FREE_TIER_USES, plan: 'free' }
      ));
    }

    return next();
  } catch (err) { next(err); }
};

// ── Require active subscription at a given plan level ─────────
exports.requireSubscription = (planLevel = 'basic') => async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_plans(name)')
      .eq('id', req.user.id)
      .single();

    if (user?.subscription_status !== 'active') {
      return res.status(402).json(error(
        'An active subscription is required for this feature.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const plan = user.subscription_plans?.name;
    const rank = (value) => {
      const normalized = value === 'student' ? 'basic' : value;
      const hierarchy = ['free', 'basic', 'pro', 'enterprise'];
      return hierarchy.indexOf(normalized);
    };

    if (rank(plan) < rank(planLevel)) {
      return res.status(402).json(error(
        `This feature requires a ${planLevel} plan or higher. You are on the ${plan} plan.`,
        { code: 'PLAN_UPGRADE_REQUIRED', required: planLevel, current: plan }
      ));
    }
    next();
  } catch (err) { next(err); }
};

// ── Check project logging limit ───────────────────────────────
exports.checkProjectLimit = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_plans(max_projects, name)')
      .eq('id', req.user.id)
      .single();

    if (!user?.subscription_plans || user?.subscription_status !== 'active') {
      return res.status(402).json(error(
        'An active subscription is required to log projects.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const maxProjects = user.subscription_plans.max_projects;
    if (maxProjects === null) return next();

    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (count >= maxProjects) {
      return res.status(402).json(error(
        `You have reached the ${maxProjects}-project limit on your ${user.subscription_plans.name} plan.`,
        { code: 'PROJECT_LIMIT_REACHED', limit: maxProjects }
      ));
    }
    next();
  } catch (err) { next(err); }
};

// ── Check BOQ creation limit (monthly) ────────────────────────
exports.checkBoqLimit = async (req, res, next) => {
  try {
    let user = null;

    // New-schema path (after migration 016).
    const { data: userWithLimit, error: withLimitErr } = await supabase
      .from('users')
      .select('subscription_status, subscription_plans(max_boq, name)')
      .eq('id', req.user.id)
      .single();

    if (!withLimitErr) {
      user = userWithLimit;
    } else {
      // Backward-compatible fallback for environments where max_boq does not exist yet.
      const { data: fallbackUser } = await supabase
        .from('users')
        .select('subscription_status, subscription_plans(name)')
        .eq('id', req.user.id)
        .single();
      user = fallbackUser;
    }

    if (!user?.subscription_plans || user?.subscription_status !== 'active') {
      return res.status(402).json(error(
        'An active subscription is required to create BOQ documents.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const maxBoq = user.subscription_plans.max_boq ?? getDefaultBoqLimit(user.subscription_plans.name);
    if (maxBoq === null) return next(); // unlimited (enterprise can be set null later)
    if (maxBoq === 0) {
      return res.status(402).json(error(
        `BOQ creation is not available on the ${user.subscription_plans.name} plan.`,
        { code: 'PLAN_UPGRADE_REQUIRED' }
      ));
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('boq_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .gte('created_at', startOfMonth.toISOString());

    if (count >= maxBoq) {
      return res.status(402).json(error(
        `You have reached the ${maxBoq} BOQ/month limit on your ${user.subscription_plans.name} plan.`,
        { code: 'BOQ_LIMIT_REACHED', used: count, limit: maxBoq, plan: user.subscription_plans.name }
      ));
    }
    next();
  } catch (err) { next(err); }
};

// ── Check invoice/document creation limit (per type, monthly) ─
exports.checkInvoiceLimit = async (req, res, next) => {
  try {
    let user = null;

    // New-schema path (after migration 016).
    const { data: userWithLimit, error: withLimitErr } = await supabase
      .from('users')
      .select('subscription_status, subscription_plans(max_invoices, name)')
      .eq('id', req.user.id)
      .single();

    if (!withLimitErr) {
      user = userWithLimit;
    } else {
      // Backward-compatible fallback for environments where max_invoices does not exist yet.
      const { data: fallbackUser } = await supabase
        .from('users')
        .select('subscription_status, subscription_plans(name)')
        .eq('id', req.user.id)
        .single();
      user = fallbackUser;
    }

    if (!user?.subscription_plans || user?.subscription_status !== 'active') {
      return res.status(402).json(error(
        'An active subscription is required to create invoices or documents.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const maxInvoices = user.subscription_plans.max_invoices ?? getDefaultInvoiceLimit(user.subscription_plans.name);
    if (maxInvoices === null) return next();
    if (maxInvoices === 0) {
      return res.status(402).json(error(
        `Invoice/document creation is not available on the ${user.subscription_plans.name} plan.`,
        { code: 'PLAN_UPGRADE_REQUIRED' }
      ));
    }

    const allowedTypes = ['invoice', 'quotation', 'valuation', 'proforma'];
    const invoiceType = allowedTypes.includes(req.body?.invoice_type)
      ? req.body.invoice_type
      : 'invoice';

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('invoice_type', invoiceType)
      .gte('created_at', startOfMonth.toISOString());

    if (count >= maxInvoices) {
      return res.status(402).json(error(
        `You have reached the ${maxInvoices} ${invoiceType}/month limit on your ${user.subscription_plans.name} plan.`,
        { code: 'INVOICE_LIMIT_REACHED', used: count, limit: maxInvoices, type: invoiceType, plan: user.subscription_plans.name }
      ));
    }
    next();
  } catch (err) { next(err); }
};
