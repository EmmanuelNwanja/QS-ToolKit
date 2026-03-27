const supabase = require('../config/supabase');
const { error } = require('../utils/responseHelper');

// New users with no active plan get this many LIFETIME calculator uses free
const FREE_TIER_USES = 3;

function normalizePlanName(planName) {
  const normalized = String(planName || '').toLowerCase();
  return normalized === 'student' ? 'basic' : normalized;
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

function getDefaultProjectLimit(planName) {
  const plan = normalizePlanName(planName);
  if (plan === 'basic') return 2;
  if (plan === 'pro') return 5;
  if (plan === 'enterprise') return 50;
  return 0;
}

function normalizeSubscriptionStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isSubscriptionCurrentlyValid(user, planName) {
  const status = normalizeSubscriptionStatus(user?.subscription_status);
  const hasPaidPlan = !!planName && planName !== 'free';

  if (status === 'active' || status === 'trial' || status === 'paid') return true;
  if (!hasPaidPlan) return false;
  if (status === 'cancelled' || status === 'expired') return false;

  // Some environments have legacy status data while plan + expiry is valid.
  if (user?.subscription_expires_at) {
    return new Date(user.subscription_expires_at) > new Date();
  }

  // Final compatibility fallback: paid plan assigned, no explicit expiry and no terminal status.
  return true;
}

async function fetchUserWithPlan(userId, planSelect) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`plan_id, subscription_status, subscription_expires_at, subscription_plans(${planSelect})`)
    .eq('id', userId)
    .single();

  if (userError) return null;

  let plan = user?.subscription_plans || null;
  if (!plan && user?.plan_id) {
    const { data: byId } = await supabase
      .from('subscription_plans')
      .select(planSelect)
      .eq('id', user.plan_id)
      .single();
    plan = byId || null;
  }

  return {
    ...user,
    subscription_plans: plan
  };
}

// ── Check calculator usage limit ──────────────────────────────
exports.checkCalculatorLimit = async (req, res, next) => {
  try {
    const user = await fetchUserWithPlan(req.user.id, 'max_calculator_uses, name');

    const plan = user?.subscription_plans;
    const planName = normalizePlanName(plan?.name);
    const isActiveSubscriber = isSubscriptionCurrentlyValid(user, planName) && plan;

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
    const user = await fetchUserWithPlan(req.user.id, 'name');

    const plan = normalizePlanName(user?.subscription_plans?.name) || 'free';

    if (!isSubscriptionCurrentlyValid(user, plan)) {
      return res.status(402).json(error(
        'An active subscription is required for this feature.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const rank = (value) => {
      const normalized = normalizePlanName(value);
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
    const user = await fetchUserWithPlan(req.user.id, 'max_projects, name');

    const planName = normalizePlanName(user?.subscription_plans?.name) || 'free';

    if (!isSubscriptionCurrentlyValid(user, planName)) {
      return res.status(402).json(error(
        'An active subscription is required to log projects.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const maxProjects = user.subscription_plans?.max_projects ?? getDefaultProjectLimit(planName);
    if (maxProjects === null) return next();

    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (count >= maxProjects) {
      return res.status(402).json(error(
        `You have reached the ${maxProjects}-project limit on your ${planName} plan.`,
        { code: 'PROJECT_LIMIT_REACHED', limit: maxProjects, plan: planName }
      ));
    }
    next();
  } catch (err) { next(err); }
};

// ── Check BOQ creation limit (monthly) ────────────────────────
exports.checkBoqLimit = async (req, res, next) => {
  try {
    const user = await fetchUserWithPlan(req.user.id, 'max_boq, name');

    const planName = normalizePlanName(user?.subscription_plans?.name) || 'free';

    if (!isSubscriptionCurrentlyValid(user, planName)) {
      return res.status(402).json(error(
        'An active subscription is required to create BOQ documents.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const maxBoq = user.subscription_plans?.max_boq ?? getDefaultBoqLimit(planName);
    if (maxBoq === null) return next(); // unlimited (enterprise can be set null later)
    if (maxBoq === 0) {
      return res.status(402).json(error(
        `BOQ creation is not available on the ${planName} plan.`,
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
        `You have reached the ${maxBoq} BOQ/month limit on your ${planName} plan.`,
        { code: 'BOQ_LIMIT_REACHED', used: count, limit: maxBoq, plan: planName }
      ));
    }
    next();
  } catch (err) { next(err); }
};

// ── Check invoice/document creation limit (per type, monthly) ─
exports.checkInvoiceLimit = async (req, res, next) => {
  try {
    const user = await fetchUserWithPlan(req.user.id, 'max_invoices, name');

    const planName = normalizePlanName(user?.subscription_plans?.name) || 'free';

    if (!isSubscriptionCurrentlyValid(user, planName)) {
      return res.status(402).json(error(
        'An active subscription is required to create invoices or documents.',
        { code: 'SUBSCRIPTION_REQUIRED' }
      ));
    }

    const maxInvoices = user.subscription_plans?.max_invoices ?? getDefaultInvoiceLimit(planName);
    if (maxInvoices === null) return next();
    if (maxInvoices === 0) {
      return res.status(402).json(error(
        `Invoice/document creation is not available on the ${planName} plan.`,
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
        `You have reached the ${maxInvoices} ${invoiceType}/month limit on your ${planName} plan.`,
        { code: 'INVOICE_LIMIT_REACHED', used: count, limit: maxInvoices, type: invoiceType, plan: planName }
      ));
    }
    next();
  } catch (err) { next(err); }
};
