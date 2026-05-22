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
  const { data: user } = await supabase
    .from('users')
    .select('plan_id, subscription_plans(name)')
    .eq('id', userId)
    .single();

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

// ─── Chat with Dr. Q ─────────────────────────────────────────-
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
