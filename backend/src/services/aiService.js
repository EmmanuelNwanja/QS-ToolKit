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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const JINA_API_KEY = process.env.JINA_API_KEY; // optional, Jina has generous free tier without key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ─── System Prompts (Domain-Calibrated for Nigerian QS) ───────
const SYSTEM_PROMPTS = {
  chat: `You are QSAI, an expert Quantity Surveying assistant specialized in Nigerian construction standards. 
You understand SMM7, NRM2, Nigerian building codes, and local practices.
Key facts you know:
- 9-inch sandcrete blocks: 10 blocks/m² (standard Nigerian rate)
- 6-inch sandcrete blocks: 12 blocks/m²
- Concrete dry-to-wet volume factor: 1.54
- Cement bags: 50kg standard
- Steel reinforcement follows BS 4449
- Laterite bulking factor: 1.35, Clay: 1.25, Loam: 1.20, Sandy: 1.10
- Longspan aluminium roofing sheets: 3.6m × 0.9m
- Paint coverage: 10m²/litre for emulsion
- Floor tiles 600×600mm: 2.78 tiles/m²; 400×400mm: 6.25 tiles/m²
- Plastering default thickness: 15mm, mix 1:4
Be concise, accurate, and practical. When uncertain, say so.`,

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
Output JSON: {"intent": "user_growth|revenue|churn|subscriptions|activity", "filters": {"date_range": "..."}, "aggregation": "..."}`
};

// ─── Generic Gemini Call ──────────────────────────────────────
async function callGemini(prompt, options = {}) {
  const { model = 'gemini-2.0-flash', imageBase64, jsonMode = true, temperature = 0.3 } = options;

  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set; AI features degraded');
    return null;
  }

  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

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

  try {
    const { data } = await axios.post(url, payload, { timeout: 60000 });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  } catch (err) {
    logger.error('Gemini API error:', err.response?.data?.error?.message || err.message);
    return null;
  }
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
    logger.error('OpenRouter error:', err.response?.data?.error?.message || err.message);
    return null;
  }
}

// ─── Unified AI Call (with fallback) ──────────────────────────
async function callAI(prompt, options = {}) {
  let result = await callGemini(prompt, options);
  if (!result && OPENROUTER_API_KEY) {
    logger.info('Falling back to OpenRouter');
    result = await callOpenRouter(prompt, options);
  }
  return result;
}

// ─── Chat with QSAI ───────────────────────────────────────────
exports.chat = async (userId, sessionId, message, context = {}) => {
  // Fetch recent conversation history (last 10 messages)
  const { data: history } = await supabase
    .from('ai_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(10);

  // Build prompt with system instruction + history + current message
  const historyText = (history || [])
    .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const contextText = context.boqTitle
    ? `\n[Context: BOQ "${context.boqTitle}"]`
    : context.projectTitle
    ? `\n[Context: Project "${context.projectTitle}"]`
    : '';

  const prompt = `${SYSTEM_PROMPTS.chat}\n${contextText}\n\nConversation history:\n${historyText}\n\nUser: ${message}\n\nAssistant:`;

  const responseText = await callAI(prompt, { temperature: 0.4, jsonMode: false });

  if (!responseText) {
    return {
      reply: 'The AI assistant is temporarily unavailable. Please try again in a moment.',
      error: true
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

  const { data: user } = await supabase
    .from('users')
    .select('plan_id, subscription_plans(name)')
    .eq('id', userId)
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

// Expose raw Gemini for advanced use
exports.callGemini = callGemini;
exports.callAI = callAI;
