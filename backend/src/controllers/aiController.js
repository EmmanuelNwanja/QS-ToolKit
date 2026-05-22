const aiService = require('../services/aiService');
const forecastingService = require('../services/forecastingService');
const rateSuggestionService = require('../services/rateSuggestionService');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

// ─── AI Health / Diagnostics ──────────────────────────────────
exports.health = async (req, res) => {
  const checks = await aiService.healthCheck();
  return res.json(success('AI health check', { checks }));
};

// ─── Feature Flag Check ───────────────────────────────────────
async function checkFeature(userId, featureKey) {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('plan_id, subscription_plans(name), org_role')
    .eq('id', userId)
    .single();

  if (userErr) {
    logger.error('checkFeature user lookup error:', userErr);
  }

  logger.debug('checkFeature for user', userId, 'org_role:', user?.org_role, 'plan:', user?.subscription_plans?.name);

  // Admins (super_admin / admin) bypass all plan checks for AI features
  const isAdmin = ['super_admin', 'admin'].includes(user?.org_role);
  if (isAdmin) {
    logger.info('Admin AI bypass granted for user', userId, 'feature:', featureKey);
    return { allowed: true, planName: 'admin' };
  }

  const planName = user?.subscription_plans?.name || 'free';

  const { data: flag } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('feature_key', featureKey)
    .single();

  if (!flag) return { allowed: false, reason: 'Feature not found' };
  if (flag.enabled_globally) return { allowed: true };
  if (flag.enabled_for_plans?.includes(planName)) return { allowed: true };
  return { allowed: false, reason: 'Upgrade your plan to access this feature' };
}

// ─── Admin AI Access Check ────────────────────────────────────
// super_admin gets automatic access. Regular admin needs explicit grant.
async function checkAdminAIAccess(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('org_role')
    .eq('id', userId)
    .single();

  if (user?.org_role === 'super_admin') return { allowed: true, role: 'super_admin' };

  const { data: grant } = await supabase
    .from('admin_ai_grants')
    .select('id, granted_by, created_at')
    .eq('user_id', userId)
    .single();

  if (grant) return { allowed: true, role: 'admin', granted_by: grant.granted_by, granted_at: grant.created_at };

  return { allowed: false, reason: 'Admin AI Engine access requires super admin privileges or an explicit grant.' };
}

// ─── Chat with Dr. Q ─────────────────────────────────---------
exports.chat = async (req, res, next) => {
  try {
    const { message, session_id, context = {} } = req.body;
    if (!message || !session_id) {
      return res.status(400).json(error('Message and session_id are required'));
    }

    const feature = await checkFeature(req.user.id, 'ai_chat');
    if (!feature.allowed) {
      return res.status(403).json(error(feature.reason, { code: 'FEATURE_NOT_AVAILABLE' }));
    }

    const limitCheck = await aiService.checkDailyLimit(req.user.id, 'chat');
    if (!limitCheck.allowed) {
      return res.status(429).json(error(`Daily AI chat limit reached (${limitCheck.limit}/${limitCheck.limit}). Upgrade for more.`, { code: 'AI_LIMIT_REACHED' }));
    }

    const result = await aiService.chat(req.user.id, session_id, message, context);
    return res.json(success('AI response', { reply: result.reply, limit: limitCheck }));
  } catch (err) {
    logger.error('AI chat error:', err.message);
    next(err);
  }
};

// ─── Get Chat History ─────────────────────────────────────────
exports.getChatHistory = async (req, res, next) => {
  try {
    const { session_id } = req.query;
    const query = supabase
      .from('ai_conversations')
      .select('role, content, created_at, context_type, context_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });

    if (session_id) query.eq('session_id', session_id);
    else query.limit(100);

    const { data, error: err } = await query;
    if (err) throw err;

    return res.json(success('Chat history', { messages: data }));
  } catch (err) { next(err); }
};

// ─── Analyze Drawing (Auto-BOQ) ───────────────────────────────
exports.analyzeDrawing = async (req, res, next) => {
  try {
    const { image_base64, project_id } = req.body;
    if (!image_base64) {
      return res.status(400).json(error('image_base64 is required'));
    }

    const feature = await checkFeature(req.user.id, 'auto_boq_drawings');
    if (!feature.allowed) {
      return res.status(403).json(error(feature.reason, { code: 'FEATURE_NOT_AVAILABLE' }));
    }

    const limitCheck = await aiService.checkDailyLimit(req.user.id, 'drawing_analysis');
    if (!limitCheck.allowed) {
      return res.status(429).json(error(`Daily drawing analysis limit reached.`, { code: 'AI_LIMIT_REACHED' }));
    }

    // Create job record
    const { data: job } = await supabase
      .from('drawing_analysis_jobs')
      .insert({
        user_id: req.user.id,
        project_id: project_id || null,
        image_url: 'data:image/jpeg;base64,...', // truncated for storage
        status: 'processing'
      })
      .select()
      .single();

    // Run analysis
    const result = await aiService.analyzeDrawing(req.user.id, image_base64, project_id);

    if (result.error) {
      await supabase.from('drawing_analysis_jobs').update({
        status: 'failed',
        error_message: result.message
      }).eq('id', job.id);
      return res.status(422).json(error(result.message));
    }

    await supabase.from('drawing_analysis_jobs').update({
      status: 'completed',
      extracted_data: result.data,
      draft_boq: result.data?.suggested_boq_sections || [],
      completed_at: new Date().toISOString()
    }).eq('id', job.id);

    return res.json(success('Drawing analyzed', {
      job_id: job.id,
      confidence: result.confidence,
      warnings: result.warnings,
      draft_boq: result.data?.suggested_boq_sections || [],
      rooms: result.data?.rooms || [],
      material_takeoff: result.data?.material_takeoff || []
    }));
  } catch (err) {
    logger.error('Analyze drawing error:', err.message);
    next(err);
  }
};

// ─── Get Drawing Analysis Job ─────────────────────────────────
exports.getDrawingJob = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('drawing_analysis_jobs')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (err || !data) return res.status(404).json(error('Job not found'));
    return res.json(success('Drawing analysis job', { job: data }));
  } catch (err) { next(err); }
};

// ─── List Drawing Jobs ────────────────────────────────────────
exports.listDrawingJobs = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('drawing_analysis_jobs')
      .select('id, project_id, status, created_at, completed_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (err) throw err;
    return res.json(success('Drawing analysis jobs', { jobs: data }));
  } catch (err) { next(err); }
};

// ─── Cost Forecast ────────────────────────────────────────────
exports.getForecast = async (req, res, next) => {
  try {
    const { project_id } = req.params;

    const feature = await checkFeature(req.user.id, 'cost_forecasting');
    if (!feature.allowed) {
      return res.status(403).json(error(feature.reason, { code: 'FEATURE_NOT_AVAILABLE' }));
    }

    const limitCheck = await aiService.checkDailyLimit(req.user.id, 'forecast');
    if (!limitCheck.allowed) {
      return res.status(429).json(error(`Daily forecast limit reached.`, { code: 'AI_LIMIT_REACHED' }));
    }

    const result = await forecastingService.buildForecast(project_id, req.user.id);
    if (result.error) {
      return res.status(400).json(error(result.message));
    }

    return res.json(success('Cost forecast', { forecast: result.forecast }));
  } catch (err) {
    logger.error('Forecast error:', err.message);
    next(err);
  }
};

// ─── Smart Rate Suggestion ────────────────────────────────────
exports.getRateSuggestion = async (req, res, next) => {
  try {
    const { description, unit } = req.query;
    if (!description || !unit) {
      return res.status(400).json(error('description and unit are required'));
    }

    const feature = await checkFeature(req.user.id, 'smart_rates');
    if (!feature.allowed) {
      return res.status(403).json(error(feature.reason, { code: 'FEATURE_NOT_AVAILABLE' }));
    }

    // Refresh suggestions if stale
    await rateSuggestionService.buildSuggestionsForUser(req.user.id);

    const suggestion = await rateSuggestionService.getSuggestion(req.user.id, description, unit);
    return res.json(success('Rate suggestion', { suggestion }));
  } catch (err) {
    logger.error('Rate suggestion error:', err.message);
    next(err);
  }
};

// ─── Admin AI Query ───────────────────────────────────────────
exports.adminQuery = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json(error('Query is required'));

    const feature = await checkFeature(req.user.id, 'admin_ai');
    if (!feature.allowed) {
      return res.status(403).json(error(feature.reason, { code: 'FEATURE_NOT_AVAILABLE' }));
    }

    const intent = await aiService.parseAdminQuery(query);
    if (!intent) {
      return res.json(success('Could not parse query', { intent: null, data: null }));
    }

    // Execute based on intent
    let data = null;
    switch (intent.intent) {
      case 'user_growth': {
        const { data: users } = await supabase
          .from('users')
          .select('created_at')
          .gte('created_at', intent.filters?.date_range?.start || new Date(Date.now() - 30 * 86400000).toISOString());
        data = { total: users?.length || 0, breakdown: users };
        break;
      }
      case 'revenue': {
        const { data: txns } = await supabase
          .from('billing_transactions')
          .select('amount, transaction_date, status')
          .eq('status', 'success');
        data = { total: txns?.reduce((s, t) => s + Number(t.amount), 0) || 0, transactions: txns };
        break;
      }
      case 'subscriptions': {
        const { data: subs } = await supabase
          .from('users')
          .select('subscription_status, plan_id, subscription_plans(name)')
          .eq('subscription_status', 'active');
        data = { active: subs?.length || 0, breakdown: subs };
        break;
      }
      default:
        data = { message: 'Query intent recognized but not yet implemented', intent };
    }

    return res.json(success('Admin query result', { intent, data }));
  } catch (err) {
    logger.error('Admin AI query error:', err.message);
    next(err);
  }
};


// ─── Admin AI Engine Chat ─────────────────────────────────────
exports.adminChat = async (req, res, next) => {
  try {
    const { message, session_id } = req.body;
    if (!message || !session_id) {
      return res.status(400).json(error('Message and session_id are required'));
    }

    const access = await checkAdminAIAccess(req.user.id);
    if (!access.allowed) {
      return res.status(403).json(error(access.reason, { code: 'ADMIN_AI_ACCESS_DENIED' }));
    }

    const result = await aiService.adminChat(req.user.id, session_id, message);
    return res.json(success('Admin AI response', { reply: result.reply, role: access.role }));
  } catch (err) {
    logger.error('Admin AI chat error:', err.message);
    next(err);
  }
};

// ─── List admin chat history ──────────────────────────────────
exports.getAdminChatHistory = async (req, res, next) => {
  try {
    const access = await checkAdminAIAccess(req.user.id);
    if (!access.allowed) {
      return res.status(403).json(error(access.reason, { code: 'ADMIN_AI_ACCESS_DENIED' }));
    }

    const { data, error: err } = await supabase
      .from('ai_conversations')
      .select('role, content, created_at')
      .eq('user_id', req.user.id)
      .eq('context_type', 'admin')
      .order('created_at', { ascending: true })
      .limit(100);

    if (err) throw err;
    return res.json(success('Admin chat history', { messages: data }));
  } catch (err) { next(err); }
};


// ─── Grant Admin AI Access ────────────────────────────────────
exports.grantAdminAI = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json(error('user_id is required'));

    // Verify requester is super_admin
    const { data: requester } = await supabase
      .from('users')
      .select('org_role')
      .eq('id', req.user.id)
      .single();

    if (requester?.org_role !== 'super_admin') {
      return res.status(403).json(error('Only super admins can grant Admin AI access'));
    }

    // Verify target user exists and is an admin
    const { data: target } = await supabase
      .from('users')
      .select('org_role, name, email')
      .eq('id', user_id)
      .single();

    if (!target) return res.status(404).json(error('User not found'));
    if (!['admin', 'super_admin'].includes(target.org_role)) {
      return res.status(400).json(error('Target user must have admin role'));
    }

    const { data: grant, error: insertErr } = await supabase
      .from('admin_ai_grants')
      .insert({ user_id, granted_by: req.user.id })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json(error('User already has Admin AI access'));
      }
      throw insertErr;
    }

    return res.json(success('Admin AI access granted', { grant, user: target }));
  } catch (err) {
    logger.error('Grant admin AI error:', err.message);
    next(err);
  }
};

// ─── Revoke Admin AI Access ───────────────────────────────────
exports.revokeAdminAI = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const { data: requester } = await supabase
      .from('users')
      .select('org_role')
      .eq('id', req.user.id)
      .single();

    if (requester?.org_role !== 'super_admin') {
      return res.status(403).json(error('Only super admins can revoke Admin AI access'));
    }

    const { error: delErr } = await supabase
      .from('admin_ai_grants')
      .delete()
      .eq('user_id', user_id);

    if (delErr) throw delErr;

    return res.json(success('Admin AI access revoked'));
  } catch (err) {
    logger.error('Revoke admin AI error:', err.message);
    next(err);
  }
};

// ─── List Admin AI Grants ─────────────────────────────────────
exports.listAdminAIGrants = async (req, res, next) => {
  try {
    const { data: requester } = await supabase
      .from('users')
      .select('org_role')
      .eq('id', req.user.id)
      .single();

    if (requester?.org_role !== 'super_admin') {
      return res.status(403).json(error('Only super admins can view Admin AI grants'));
    }

    const { data: grants, error: err } = await supabase
      .from('admin_ai_grants')
      .select('id, user_id, granted_by, created_at, users:user_id(name, email, org_role)')
      .order('created_at', { ascending: false });

    if (err) throw err;

    return res.json(success('Admin AI grants', { grants: grants || [] }));
  } catch (err) {
    logger.error('List admin AI grants error:', err.message);
    next(err);
  }
};
