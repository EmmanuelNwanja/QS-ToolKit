/**
 * aiService.js
 * Unified AI interface for QSToolkit V1.10
 * Providers: Google Gemini (primary), Jina AI (embeddings), OpenRouter (fallback)
 * All free-tier only.
 */

const axios = require('axios');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// ─── Configuration ────────────────────────────────────────────
const GEMINI_API_KEY_RAW = process.env.GEMINI_API_KEY || '';
const GEMINI_API_KEY = GEMINI_API_KEY_RAW.replace(/^["']|["']$/g, '').trim();
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GROQ_API_KEY_RAW = process.env.GROQ_API_KEY || '';
const GROQ_API_KEY = GROQ_API_KEY_RAW.replace(/^["']|["']$/g, '').trim();
const JINA_API_KEY = process.env.JINA_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MOCK_AI_MODE = process.env.MOCK_AI_MODE === 'true';

// ─── System Prompts (Domain-Calibrated for Nigerian QS) ───────
const SYSTEM_PROMPTS = {
  chat: `You are Dr. Q, an expert Quantity Surveying assistant specialized in Nigerian construction standards. 
You understand SMM7, NRM2, Nigerian building codes, and local practices.
Key facts you know:
- 9-inch sandcrete blocks: 10 blocks/m² (standard Nigerian rate)
- 6-inch sandcrete blocks: 12 blocks/m²
- 5-inch sandcrete blocks: 14 blocks/m²
- Concrete dry-to-wet volume factor: 1.54
- Cement bags: 50kg standard
- Steel reinforcement follows BS 4449
- Laterite bulking factor: 1.35, Clay: 1.25, Loam: 1.20, Sandy: 1.10
- Longspan aluminium roofing sheets: 3.6m × 0.9m
- Paint coverage: 10m²/litre for emulsion
- Floor tiles 600×600mm: 2.78 tiles/m²; 400×400mm: 6.25 tiles/m²
- Plastering default thickness: 15mm, mix 1:4
You have access to the user's profile, projects, BOQs, and invoices. Use this context to give personalized, relevant answers. Reference their specific projects or BOQs when appropriate. Be concise, accurate, and practical. When uncertain, say so.`,

  drawingAnalysis: `Analyze this architectural drawing and extract quantities for a Bill of Quantities.
Output valid JSON only with this structure:
{
  "project_summary": "brief description",
  "rooms": [
    {
      "name": "e.g. Living Room",
      "dimensions": {"length_m": 0, "width_m": 0, "height_m": 0},
      "elements": [
        {"type": "wall|floor|ceiling|door|window", "description": "...", "quantity": 0, "unit": "m2|m|nr|m3"}
      ]
    }
  ],
  "material_takeoff": [
    {"material": "...", "quantity": 0, "unit": "...", "notes": "..."}
  ],
  "suggested_boq_sections": [
    {
      "title": "e.g. Substructure",
      "items": [
        {"item_no": "1.1", "description": "...", "unit": "...", "quantity": 0, "rate": 0}
      ]
    }
  ],
  "confidence": "high|medium|low",
  "warnings": ["Any uncertainties or needed clarifications"]
}
Use Nigerian construction standards. Estimate quantities where dimensions are inferable.`,

  rateSuggestion: `You are analyzing historical BOQ data to suggest market rates.
Given a description and unit, suggest a fair rate in NGN based on Nigerian construction market conditions.
Output JSON: {"suggested_rate": 0, "rate_low": 0, "rate_high": 0, "confidence": "high|medium|low", "reasoning": "..."}`,

  varianceSummary: `Compare two BOQ versions and summarize changes.
Output JSON: {"summary": "...", "changes": [{"type": "added|removed|modified", "section": "...", "description": "...", "before": "...", "after": "..."}], "impact": "..."}`,

  forecast: `You are a project cost forecasting expert. Given project data, predict final cost and risk.
Output JSON: {"predicted_final_value": 0, "confidence_score": 0-100, "risk_level": "low|medium|high|critical", "factors": [{"name": "...", "impact": "..."}], "recommendation": "..."}`,

  adminQuery: `You help admin users query platform analytics. Translate natural language to structured intent.
Output JSON: {"intent": "user_growth|revenue|churn|subscriptions|activity", "filters": {"date_range": "..."}, "aggregation": "..."}`,

  adminChat: `You are Dr. Q Admin, the AI assistant for QSToolkit platform administrators.
You have access to real-time platform analytics and can help with:
- User growth, churn, and engagement metrics
- Revenue, subscriptions, and billing insights
- Platform health and activity monitoring
- Content drafting (announcements, emails, policies)
- Operational recommendations based on data

When answering, cite specific numbers from the context. Be concise but thorough.
If asked to take an action you cannot perform, explain what you can do instead.`
};

// ─── Generic Gemini Call ──────────────────────────────────────
async function callGemini(prompt, options = {}) {
  const { model = 'gemini-2.0-flash', imageBase64, jsonMode = true, temperature = 0.3 } = options;

  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set; AI features degraded');
    return null;
  }

  // Fallback model names if the primary fails
  const modelsToTry = [model, 'gemini-2.0-flash-latest', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.unshift({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      responseMimeType: jsonMode ? 'application/json' : 'text/plain'
    }
  };

  for (const m of modelsToTry) {
    const url = `${GEMINI_BASE_URL}/models/${m}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const { data } = await axios.post(url, payload, { timeout: 60000 });
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return text;
    } catch (err) {
      const status = err.response?.status;
      const resData = err.response?.data;
      logger.error(`Gemini API error (model=${m}, status=${status}):`, JSON.stringify(resData), err.message);
      // Continue to next model on 404 (model not found); abort on auth errors
      if (status === 401 || status === 403) {
        logger.error('Gemini API auth error — check that the Generative Language API is enabled in Google Cloud Console and the key is valid.');
        break;
      }
      // For other errors (429, 500, etc.), try next model
      continue;
    }
  }
  return null;
}

// ─── Fallback: GROQ ───────────────────────────────────────────
async function callGroq(prompt, options = {}) {
  if (!GROQ_API_KEY) return null;
  const { jsonMode = true, temperature = 0.3 } = options;

  // Fallback models if primary is unavailable
  const modelsToTry = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];

  const messages = [];
  const systemMatch = prompt.match(/^([\s\S]*?)\n\nConversation history:/);
  if (systemMatch) {
    messages.push({ role: 'system', content: systemMatch[1].trim() });
    messages.push({ role: 'user', content: prompt.replace(systemMatch[0], '').trim() });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  for (const model of modelsToTry) {
    try {
      const payload = {
        model,
        messages,
        temperature,
        max_tokens: 8192
      };
      if (jsonMode) payload.response_format = { type: 'json_object' };

      const { data } = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      return data?.choices?.[0]?.message?.content || '';
    } catch (err) {
      const status = err.response?.status;
      const resData = err.response?.data;
      const dataStr = typeof resData === 'string' ? resData.slice(0, 500) : JSON.stringify(resData)?.slice(0, 500);
      logger.error(`GROQ error model=${model} status=${status} code=${err.code} msg=${err.message} data=${dataStr}`);
      // Abort on auth errors; try next model on others
      if (status === 401 || status === 403) break;
      continue;
    }
  }
  return null;
}

// ─── Fallback: OpenRouter ─────────────────────────────────────
async function callOpenRouter(prompt, options = {}) {
  if (!OPENROUTER_API_KEY) return null;
  const { model = 'google/gemini-2.0-flash-exp:free', jsonMode = true } = options;

  try {
    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        response_format: jsonMode ? { type: 'json_object' } : undefined
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://qstoolkit.com',
          'X-Title': 'QSToolkit'
        },
        timeout: 60000
      }
    );
    return data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    const status = err.response?.status;
    const resData = err.response?.data;
    const dataStr = typeof resData === 'string' ? resData.slice(0, 500) : JSON.stringify(resData)?.slice(0, 500);
    logger.error(`OpenRouter error status=${status} code=${err.code} msg=${err.message} data=${dataStr}`);
    return null;
  }
}

// ─── Unified AI Call (with fallback chain) ────────────────────
async function callAI(prompt, options = {}) {
  let result = await callGemini(prompt, options);
  if (!result && GROQ_API_KEY) {
    logger.info('Falling back to GROQ');
    result = await callGroq(prompt, options);
  }
  if (!result && OPENROUTER_API_KEY) {
    logger.info('Falling back to OpenRouter');
    result = await callOpenRouter(prompt, options);
  }
  return result;
}

// ─── Enrich prompt with user-specific data ────────────────────
async function buildUserContext(userId) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('name, email, user_type, company_name, university_name, qs_cert_no, phone, company_address, plan_id, subscription_status, created_at')
      .eq('id', userId)
      .single();

    const { data: projects } = await supabase
      .from('projects')
      .select('title, project_type, location, state, status, estimated_value, final_value')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: boqs } = await supabase
      .from('boq_documents')
      .select('title, contract_no, client_name, location, total_amount, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_no, client_name, total_amount, status, issue_date')
      .eq('user_id', userId)
      .order('issue_date', { ascending: false })
      .limit(3);

    let ctx = '';
    if (user) {
      ctx += `User: ${user.name || 'User'} (${user.user_type || 'unknown'})`;
      if (user.company_name) ctx += `, Company: ${user.company_name}`;
      if (user.university_name) ctx += `, University: ${user.university_name}`;
      if (user.qs_cert_no) ctx += `, QS Cert: ${user.qs_cert_no}`;
      if (user.plan_id) ctx += `, Plan: ${user.plan_id}`;
      ctx += '\n';
    }

    if (projects?.length) {
      ctx += `Recent Projects:\n${projects.map(p =>
        `  - "${p.title}" (${p.project_type || 'unknown'}) in ${p.location || p.state || 'Nigeria'} — Status: ${p.status || 'N/A'}, Est: ₦${p.estimated_value || 0}`
      ).join('\n')}\n`;
    }

    if (boqs?.length) {
      ctx += `Recent BOQs:\n${boqs.map(b =>
        `  - "${b.title}" for ${b.client_name || 'unknown client'} — Total: ₦${b.total_amount || 0}, Status: ${b.status || 'draft'}`
      ).join('\n')}\n`;
    }

    if (invoices?.length) {
      ctx += `Recent Invoices:\n${invoices.map(i =>
        `  - ${i.invoice_no} to ${i.client_name} — ₦${i.total_amount}, Status: ${i.status}`
      ).join('\n')}\n`;
    }

    return ctx || 'No additional user context available.';
  } catch (err) {
    logger.warn('Failed to build user context:', err.message);
    return '';
  }
}

// ─── Chat with Dr. Q ─────────────────────────────────--------
exports.chat = async (userId, sessionId, message, context = {}) => {
  // Fetch recent conversation history (last 10 messages)
  const { data: history } = await supabase
    .from('ai_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(10);

  // Build prompt with system instruction + user context + history + current message
  const historyText = (history || [])
    .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const userContext = await buildUserContext(userId);

  const contextText = context.boqTitle
    ? `\n[Context: BOQ "${context.boqTitle}"]`
    : context.projectTitle
    ? `\n[Context: Project "${context.projectTitle}"]`
    : '';

  const prompt = `${SYSTEM_PROMPTS.chat}\n\n${userContext}${contextText}\n\nConversation history:\n${historyText}\n\nUser: ${message}\n\nAssistant:`;

  let responseText = await callAI(prompt, { temperature: 0.4, jsonMode: false });

  // Graceful fallback: if no external AI is configured, use knowledge-base mock responses
  if (!responseText && !GEMINI_API_KEY && !GROQ_API_KEY && !OPENROUTER_API_KEY) {
    responseText = await mockDrQResponse(message, context);
  }

  if (!responseText) {
    return {
      reply: 'Dr. Q is temporarily unavailable — the AI service is not configured or encountered an error. Please contact support or try again shortly.',
      error: true,
      code: 'AI_SERVICE_UNAVAILABLE'
    };
  }

  // Store conversation
  await supabase.from('ai_conversations').insert([
    { user_id: userId, session_id: sessionId, role: 'user', content: message, context_type: context.type || 'general', context_id: context.id },
    { user_id: userId, session_id: sessionId, role: 'model', content: responseText, context_type: context.type || 'general', context_id: context.id, model_used: 'gemini-flash' }
  ]);

  // Track usage
  await trackUsage(userId, 'chat');

  return { reply: responseText, error: false };
};

// ─── Fetch real-time admin platform context ───────────────────
async function fetchAdminContext() {
  try {
    const today = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // User stats
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: newUsers7d } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo);
    const { count: newUsers30d } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo);

    // Subscriptions
    const { count: activeSubs } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active');
    const { data: plans } = await supabase.from('users').select('plan_id, subscription_plans(name)').eq('subscription_status', 'active');
    const planBreakdown = {};
    (plans || []).forEach(p => {
      const name = p.subscription_plans?.name || 'unknown';
      planBreakdown[name] = (planBreakdown[name] || 0) + 1;
    });

    // Revenue
    const { data: revenue30d } = await supabase
      .from('billing_transactions')
      .select('amount')
      .eq('status', 'success')
      .gte('transaction_date', thirtyDaysAgo);
    const revenueTotal = (revenue30d || []).reduce((s, t) => s + Number(t.amount || 0), 0);

    // Pending invoices/quotes
    const { count: pendingInvoices } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: draftBoqs } = await supabase.from('boq_documents').select('*', { count: 'exact', head: true }).eq('status', 'draft');

    // Recent activity
    const { data: recentUsers } = await supabase
      .from('users')
      .select('name, email, created_at, user_type')
      .order('created_at', { ascending: false })
      .limit(5);

    return `Platform Snapshot (as of ${today.split('T')[0]}):
- Total Users: ${totalUsers || 0}
- New Users (7d): ${newUsers7d || 0} | (30d): ${newUsers30d || 0}
- Active Subscriptions: ${activeSubs || 0}
- Plan Breakdown: ${JSON.stringify(planBreakdown)}
- Revenue (30d): ₦${revenueTotal.toLocaleString()}
- Pending Invoices: ${pendingInvoices || 0}
- Draft BOQs: ${draftBoqs || 0}
- Recent Signups: ${(recentUsers || []).map(u => `${u.name} (${u.user_type}) — ${u.created_at.split('T')[0]}`).join('; ') || 'None'}`;
  } catch (err) {
    logger.warn('Failed to fetch admin context:', err.message);
    return 'Platform data temporarily unavailable.';
  }
}

// ─── Admin Chat with Dr. Q Admin ──────────────────────────────
exports.adminChat = async (userId, sessionId, message) => {
  // Fetch recent admin conversation history
  const { data: history } = await supabase
    .from('ai_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('context_type', 'admin')
    .order('created_at', { ascending: true })
    .limit(20);

  const historyText = (history || [])
    .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const adminContext = await fetchAdminContext();

  const prompt = `${SYSTEM_PROMPTS.adminChat}\n\n${adminContext}\n\nConversation history:\n${historyText}\n\nUser: ${message}\n\nAssistant:`;

  let responseText = await callAI(prompt, { temperature: 0.3, jsonMode: false });

  if (!responseText) {
    return {
      reply: 'Dr. Q Admin is temporarily unavailable — the AI service encountered an error. Please try again shortly.',
      error: true,
      code: 'AI_SERVICE_UNAVAILABLE'
    };
  }

  // Store conversation
  await supabase.from('ai_conversations').insert([
    { user_id: userId, session_id: sessionId, role: 'user', content: message, context_type: 'admin' },
    { user_id: userId, session_id: sessionId, role: 'model', content: responseText, context_type: 'admin', model_used: 'gemini-flash' }
  ]);

  return { reply: responseText, error: false };
};

// ─── Analyze Drawing → BOQ Draft ──────────────────────────────
exports.analyzeDrawing = async (userId, imageBase64, projectId = null) => {
  const prompt = SYSTEM_PROMPTS.drawingAnalysis;
  const result = await callGemini(prompt, { imageBase64, jsonMode: true, temperature: 0.2 });

  if (!result) return { error: true, message: 'Drawing analysis failed. Please try again.' };

  let parsed;
  try {
    parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e) {
    logger.error('Failed to parse drawing analysis JSON:', result.substring(0, 500));
    return { error: true, message: 'Could not parse AI response. Try a clearer drawing.' };
  }

  await trackUsage(userId, 'drawing_analysis');

  return {
    error: false,
    data: parsed,
    confidence: parsed.confidence || 'medium',
    warnings: parsed.warnings || []
  };
};

// ─── Generate Cost Forecast ───────────────────────────────────
exports.generateForecast = async (projectData, boqData, historicalProjects = []) => {
  const prompt = `${SYSTEM_PROMPTS.forecast}\n\nProject Data:\n${JSON.stringify(projectData, null, 2)}\n\nCurrent BOQ Total: ${boqData?.total_amount || 0}\n\nHistorical Projects (anonymized): ${JSON.stringify(historicalProjects.map(p => ({ estimated: p.estimated_value, final: p.final_value, type: p.project_type })), null, 2)}\n\nProvide forecast JSON:`;

  const result = await callAI(prompt, { jsonMode: true, temperature: 0.2 });
  if (!result) return null;

  try {
    return JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e) {
    logger.error('Forecast parse error');
    return null;
  }
};

// ─── Summarize BOQ Variance ───────────────────────────────────
exports.summarizeVariance = async (oldSnapshot, newSnapshot) => {
  const prompt = `${SYSTEM_PROMPTS.varianceSummary}\n\nOLD VERSION:\n${JSON.stringify(oldSnapshot, null, 2)}\n\nNEW VERSION:\n${JSON.stringify(newSnapshot, null, 2)}\n\nProvide variance JSON:`;

  const result = await callAI(prompt, { jsonMode: true, temperature: 0.2 });
  if (!result) return null;

  try {
    return JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e) {
    return null;
  }
};

// ─── Suggest Rate from Description ────────────────────────────
exports.suggestRate = async (description, unit, historicalRates = []) => {
  const prompt = `${SYSTEM_PROMPTS.rateSuggestion}\n\nItem: "${description}"\nUnit: ${unit}\n\nHistorical rates for similar items: ${JSON.stringify(historicalRates)}\n\nProvide JSON:`;

  const result = await callAI(prompt, { jsonMode: true, temperature: 0.2 });
  if (!result) return null;

  try {
    return JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e) {
    return null;
  }
};

// ─── Admin NL → Query Intent ──────────────────────────────────
exports.parseAdminQuery = async (naturalLanguage) => {
  const prompt = `${SYSTEM_PROMPTS.adminQuery}\n\nQuery: "${naturalLanguage}"\n\nProvide JSON:`;
  const result = await callAI(prompt, { jsonMode: true, temperature: 0.1 });
  if (!result) return null;

  try {
    return JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e) {
    return null;
  }
};

// ─── Usage Tracking ───────────────────────────────────────────
async function trackUsage(userId, type) {
  const today = new Date().toISOString().split('T')[0];
  const column = type === 'drawing_analysis' ? 'drawing_analysis_requests' : type === 'forecast' ? 'forecast_requests' : 'chat_requests';

  const { data: existing } = await supabase
    .from('ai_usage_daily')
    .select('id')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();

  if (existing) {
    await supabase.rpc('increment_ai_usage', {
      p_id: existing.id,
      p_column: column
    });
  } else {
    await supabase.from('ai_usage_daily').insert({
      user_id: userId,
      usage_date: today,
      [column]: 1
    });
  }
}

// ─── Daily Limit Check ────────────────────────────────────────
exports.checkDailyLimit = async (userId, type) => {
  // Check platform admin first
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('admin_role')
    .eq('user_id', userId)
    .single();

  if (adminUser?.admin_role === 'super_admin') {
    return { allowed: true, used: 0, limit: 99999, planName: 'admin' };
  }

  const { data: user } = await supabase
    .from('users')
    .select('plan_id, subscription_plans(name), org_role')
    .eq('id', userId)
    .single();

  // Admins get unlimited AI access
  const isAdmin = ['super_admin', 'admin'].includes(user?.org_role);
  if (isAdmin) return { allowed: true, used: 0, limit: 99999, planName: 'admin' };

  const planLimits = {
    free: { chat: 3, drawing_analysis: 0, forecast: 0 },
    student: { chat: 10, drawing_analysis: 1, forecast: 1 },
    pro: { chat: 50, drawing_analysis: 10, forecast: 10 },
    enterprise: { chat: 200, drawing_analysis: 50, forecast: 50 }
  };

  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase
    .from('ai_usage_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();

  const planName = user?.subscription_plans?.name || 'free';
  const limit = planLimits[planName]?.[type] ?? 0;
  const used = usage?.[type === 'drawing_analysis' ? 'drawing_analysis_requests' : type === 'forecast' ? 'forecast_requests' : 'chat_requests'] || 0;

  return { allowed: used < limit, used, limit, planName };
};

// ─── Jina AI Embeddings (optional RAG enhancement) ────────────
exports.getEmbedding = async (text) => {
  try {
    const { data } = await axios.post(
      'https://api.jina.ai/v1/embeddings',
      { input: [text], model: 'jina-embeddings-v3' },
      {
        headers: {
          Authorization: `Bearer ${JINA_API_KEY || ''}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    return data?.data?.[0]?.embedding || null;
  } catch (err) {
    logger.error('Jina embedding error:', err.message);
    return null;
  }
};

// ─── Mock Dr. Q Fallback (zero API cost, uses local knowledge) ─
async function mockDrQResponse(message, context) {
  const lower = message.toLowerCase();

  // Block coverage
  if (lower.includes('block') && (lower.includes('how many') || lower.includes('quantity') || lower.includes('m2') || lower.includes('square'))) {
    return 'For sandcrete blockwork in Nigeria:\n• 9-inch blocks: 10 blocks per m²\n• 6-inch blocks: 12 blocks per m²\n• 5-inch blocks: 14 blocks per m²\n\nExample: A 12m × 3m wall = 36 m². For 9-inch blocks: 36 × 10 = 360 blocks. Add 5-10% for wastage.';
  }

  // Concrete
  if (lower.includes('concrete') && (lower.includes('mix') || lower.includes('ratio') || lower.includes('cement'))) {
    return 'Common Nigerian concrete mix ratios:\n• 1:2:4 — Rich concrete for columns and beams\n• 1:3:6 — Standard for slabs and foundations\n• 1:4:8 — Lean concrete for blinding\n\nDry-to-wet volume factor = 1.54. One 50kg cement bag ≈ 0.0347 m³.';
  }

  // Steel
  if (lower.includes('steel') || lower.includes('rebar') || lower.includes('reinforcement')) {
    return 'BS 4449 steel bar unit weights (kg/m):\n• 8mm = 0.395\n• 10mm = 0.617\n• 12mm = 0.888\n• 16mm = 1.579\n• 20mm = 2.466\n• 25mm = 3.854\n\nOverlap length = 40 × bar diameter. For a 12mm bar: 40 × 12 = 480mm overlap.';
  }

  // SMM7 vs NRM2
  if (lower.includes('smm7') || lower.includes('nrm2') || lower.includes('measurement')) {
    return 'SMM7 (Standard Method of Measurement 7th Edition) is the traditional UK-based method. NRM2 (New Rules of Measurement) replaces it with more detailed preliminaries and greater emphasis on risk allocation. Both quantify work net as fixed in position.';
  }

  // Paint
  if (lower.includes('paint') || lower.includes('coverage')) {
    return 'Standard emulsion paint coverage in Nigeria = 10 m² per litre per coat. Standard tin sizes: 5L, 4L, 1L. Two coats are standard for new plastered surfaces. For a 50 m² room: 50 ÷ 10 = 5L per coat × 2 coats = 10L total (two 5L tins).';
  }

  // Roofing
  if (lower.includes('roof') || lower.includes('aluminium')) {
    return 'Longspan aluminium roofing sheets in Nigeria: 3.6m × 0.9m (0.9m effective cover) = 3.24 m² per sheet. Standard gauges: 0.45mm or 0.55mm. Allow 10-15% waste on gable roofs, 15-20% on hipped roofs.';
  }

  // Bulking
  if (lower.includes('bulk') || lower.includes('laterite') || lower.includes('excavation')) {
    return 'Soil bulking factors for Nigerian earthwork:\n• Laterite = 1.35\n• Clay = 1.25\n• Loam = 1.20\n• Sandy soil = 1.10\n\nExample: 100 m³ of laterite excavation × 1.35 = 135 m³ haulage volume.';
  }

  // Plastering
  if (lower.includes('plaster')) {
    return 'Standard plastering thickness in Nigeria = 15mm. Common mix ratio = 1:4 (cement:sand). Coverage varies by wall texture — typically 12-15 m² per 50kg cement bag for 15mm thickness.';
  }

  // Tiles
  if (lower.includes('tile')) {
    return 'Floor tile quantities per m²:\n• 600×600mm = 2.78 tiles/m²\n• 400×400mm = 6.25 tiles/m²\n• 300×300mm = 11.11 tiles/m²\n\nAllow 5-10% cutting waste. Example: 20 m² room with 600×600 tiles = 20 × 2.78 = 55.6 → 62 tiles (with 10% waste).';
  }

  // General fallback
  return `I'm Dr. Q, your Quantity Surveying assistant. I can help with Nigerian construction standards, BOQ preparation, material quantities, and cost calculations.\n\nTry asking me about:\n• Block quantities for walls\n• Concrete mix ratios\n• Steel reinforcement weights\n• Paint or tiling coverage\n• SMM7 vs NRM2 standards\n\n*Note: Dr. Q is currently running in offline knowledge mode. For full AI capabilities, ask your admin to configure an AI API key.*`;
}

// ─── Health Check (diagnostic) ────────────────────────────────
exports.healthCheck = async () => {
  const checks = {
    gemini_key_present: !!GEMINI_API_KEY,
    gemini_key_preview: GEMINI_API_KEY ? `${GEMINI_API_KEY.slice(0, 8)}...${GEMINI_API_KEY.slice(-4)}` : null,
    gemini_key_length: GEMINI_API_KEY.length,
    gemini_key_starts_with_aiza: GEMINI_API_KEY.startsWith('AIza'),
    groq_key_present: !!GROQ_API_KEY,
    groq_key_preview: GROQ_API_KEY ? `${GROQ_API_KEY.slice(0, 4)}...${GROQ_API_KEY.slice(-4)}` : null,
    groq_key_length: GROQ_API_KEY.length,
    openrouter_key_present: !!OPENROUTER_API_KEY,
    jina_key_present: !!JINA_API_KEY,
    mock_mode: MOCK_AI_MODE
  };

  // Try a minimal Gemini ping
  if (GEMINI_API_KEY) {
    const url = `${GEMINI_BASE_URL}/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const { data } = await axios.post(url, {
        contents: [{ role: 'user', parts: [{ text: 'Say "OK"' }] }],
        generationConfig: { maxOutputTokens: 10 }
      }, { timeout: 15000 });
      checks.gemini_ping = 'success';
      checks.gemini_ping_response = data?.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 50) || 'empty';
    } catch (err) {
      checks.gemini_ping = 'failed';
      checks.gemini_ping_status = err.response?.status;
      checks.gemini_ping_error = err.response?.data || err.message;
    }
  } else {
    checks.gemini_ping = 'skipped_no_key';
  }

  // Try a minimal GROQ ping
  if (GROQ_API_KEY) {
    try {
      const { data } = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5
        },
        {
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
      checks.groq_ping = 'success';
      checks.groq_ping_response = data?.choices?.[0]?.message?.content?.substring(0, 50) || 'empty';
    } catch (err) {
      checks.groq_ping = 'failed';
      checks.groq_ping_status = err.response?.status;
      checks.groq_ping_code = err.code;
      checks.groq_ping_error = typeof err.response?.data === 'string' ? err.response.data.slice(0, 300) : JSON.stringify(err.response?.data)?.slice(0, 300) || err.message;
    }
  } else {
    checks.groq_ping = 'skipped_no_key';
  }

  return checks;
};

// Expose raw Gemini for advanced use
exports.callGemini = callGemini;
exports.callAI = callAI;
