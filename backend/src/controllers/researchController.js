const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { callAI } = require('../services/aiService');
const { initializePayment } = require('../services/paymentGateway');

const STAGE_NAMES = [
  '', 'Topic Definition', 'Literature Search', 'Literature Review',
  'Methodology Design', 'Data Collection', 'Data Analysis',
  'Draft Writing', 'Peer Review', 'Revision', 'Final & Archive'
];

// ─── Projects CRUD ────────────────────────────────────────────

exports.createProject = async (req, res, next) => {
  try {
    const { title, description, research_type, tags } = req.body;
    if (!title || !research_type) {
      return res.status(400).json(error('title and research_type are required'));
    }

    const { data: project, err } = await supabase.from('research_projects').insert({
      user_id: req.user.id,
      title,
      description: description || '',
      research_type,
      tags: tags || [],
      stage_data: {
        stage_1: { title, objectives: [], keywords: [], research_question: '' }
      }
    }).select('*').single();

    if (err) throw err;
    return res.status(201).json(success('Project created', project));
  } catch (err) { next(err); }
};

exports.getProjects = async (req, res, next) => {
  try {
    const { status } = req.query;
    let q = supabase.from('research_projects')
      .select('*')
      .eq('user_id', req.user.id);
    if (status) q = q.eq('status', status);
    q = q.order('updated_at', { ascending: false });

    const { data: projects, err } = await q;
    if (err) throw err;
    return res.json(success('Projects fetched', { projects }));
  } catch (err) { next(err); }
};

exports.getProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: project, err } = await supabase.from('research_projects')
      .select('*').eq('id', id).single();

    if (err || !project) return res.status(404).json(error('Project not found'));

    // Check access
    if (project.user_id !== req.user.id) {
      const { data: collab } = await supabase.from('research_collaborations')
        .select('role').eq('project_id', id).eq('user_id', req.user.id).maybeSingle();
      if (!collab) return res.status(403).json(error('Access denied'));
    }

    return res.json(success('Project fetched', project));
  } catch (err) { next(err); }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, tags, is_public } = req.body;

    const { data: project, err } = await supabase.from('research_projects')
      .update({ title, description, tags, is_public })
      .eq('id', id).eq('user_id', req.user.id)
      .select('*').single();

    if (err) throw err;
    return res.json(success('Project updated', project));
  } catch (err) { next(err); }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { err } = await supabase.from('research_projects')
      .delete().eq('id', id).eq('user_id', req.user.id);
    if (err) throw err;
    return res.json(success('Project deleted'));
  } catch (err) { next(err); }
};

// ─── Stage Advancement ────────────────────────────────────────

exports.advanceStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: project } = await supabase.from('research_projects')
      .select('current_stage, stage_data').eq('id', id).eq('user_id', req.user.id).single();

    if (!project) return res.status(404).json(error('Project not found'));

    const nextStage = project.current_stage + 1;
    if (nextStage > 10) {
      return res.status(400).json(error('Project is already at final stage'));
    }

    const { data: updated, err } = await supabase.from('research_projects')
      .update({
        current_stage: nextStage,
        status: nextStage === 10 ? 'completed' : 'in_progress'
      }).eq('id', id).select('*').single();

    if (err) throw err;
    return res.json(success(`Advanced to Stage ${nextStage}: ${STAGE_NAMES[nextStage]}`, updated));
  } catch (err) { next(err); }
};

exports.updateStageData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage_num, data: stageData } = req.body;

    if (!stage_num || stage_num < 1 || stage_num > 10) {
      return res.status(400).json(error('stage_num must be 1-10'));
    }

    const { data: project } = await supabase.from('research_projects')
      .select('stage_data').eq('id', id).eq('user_id', req.user.id).single();

    if (!project) return res.status(404).json(error('Project not found'));

    const updatedStageData = { ...project.stage_data, [`stage_${stage_num}`]: stageData };

    const { data: updated, err } = await supabase.from('research_projects')
      .update({ stage_data: updatedStageData }).eq('id', id).select('*').single();

    if (err) throw err;
    return res.json(success('Stage data saved', updated));
  } catch (err) { next(err); }
};

// ─── AI Assist (Stage-Aware) ─────────────────────────────────

exports.aiAssist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage_num, prompt: userPrompt } = req.body;

    const { data: project } = await supabase.from('research_projects')
      .select('*').eq('id', id).eq('user_id', req.user.id).single();

    if (!project) return res.status(404).json(error('Project not found'));

    const stage = stage_num || project.current_stage;
    const stageData = project.stage_data?.[`stage_${stage}`] || {};

    const prompts = {
      1: `You are Dr. Q, helping a Nigerian QS student refine their research topic.
Topic: ${project.title}
Current data: ${JSON.stringify(stageData)}
User input: ${userPrompt || 'Help me refine this research question'}

Suggest 3 focused research questions and 10 keywords for Nigerian QS research.
Output JSON: { "research_question": "...", "objectives": ["..."], "keywords": ["..."] }`,

      2: `You are Dr. Q, helping find literature sources for QS research.
Topic: ${project.title}
Keywords: ${stageData.keywords?.join(', ') || 'QS, quantity surveying, Nigeria'}
User input: ${userPrompt || 'Find relevant sources'}

Suggest 10 relevant academic sources with titles, authors, years, and relevance scores (1-5).
Output JSON: { "sources": [{ "title": "...", "authors": ["..."], "year": 2024, "type": "journal", "relevance_score": 4, "notes": "..." }] }`,

      3: `You are Dr. Q, synthesizing literature for a QS research review.
Topic: ${project.title}
Sources: ${JSON.stringify(stageData.sources || [])}
User input: ${userPrompt || 'Synthesize these sources into themes'}

Identify 3-5 key themes, group sources by theme, and highlight gaps.
Output JSON: { "themes": [{ "theme": "...", "source_indices": [0,1], "synthesis": "...", "gaps": "..." }] }`,

      4: `You are Dr. Q, designing methodology for QS research.
Topic: ${project.title}
Research question: ${stageData.research_question || project.title}
Themes: ${JSON.stringify(stageData.themes || [])}
User input: ${userPrompt || 'Suggest a methodology'}

Suggest a research methodology appropriate for Nigerian QS context.
Output JSON: { "method": "quantitative|qualitative|mixed", "approach": "...", "sample_size": "...", "tools": ["..."], "limitations": ["..."] }`,

      5: `You are Dr. Q, helping collect data for QS research.
Topic: ${project.title}
Methodology: ${JSON.stringify(stageData)}
User input: ${userPrompt || 'Help me collect data'}

Suggest data points to collect, sources, and a collection template.
Output JSON: { "data_points": [{ "source": "...", "value_type": "...", "unit": "...", "region": "..." }], "template": "..." }`,

      6: `You are Dr. Q, analyzing QS research data.
Topic: ${project.title}
Data: ${JSON.stringify(stageData.data_points || [])}
User input: ${userPrompt || 'Analyze this data'}

Suggest analysis methods and provide initial findings.
Output JSON: { "analysis_type": "...", "findings": ["..."], "suggested_charts": ["..."] }`,

      7: `You are Dr. Q, writing a draft section for QS research.
Topic: ${project.title}
Findings: ${JSON.stringify(stageData.findings || [])}
User input: ${userPrompt || 'Write the methodology section'}

Generate a well-structured draft section with Nigerian QS context and references.
Output JSON: { "heading": "...", "content": "...", "word_count": 500, "references": ["..."] }`,

      8: `You are Dr. Q, performing peer review of QS research.
Topic: ${project.title}
Draft: ${JSON.stringify(stageData.sections || [])}
User input: ${userPrompt || 'Review this draft'}

Provide constructive feedback on academic rigor, methodology, and Nigerian QS relevance.
Output JSON: { "reviewers": [{ "name": "QS Expert", "feedback": "...", "score": 4, "criteria": "..." }], "overall_score": 4, "suggestions": ["..."] }`,

      9: `You are Dr. Q, suggesting revisions for QS research.
Topic: ${project.title}
Review: ${JSON.stringify(stageData.reviewers || [])}
Original: ${JSON.stringify(stageData.sections || [])}
User input: ${userPrompt || 'Suggest specific revisions'}

Compare original with review feedback and suggest specific improvements.
Output JSON: { "revisions": [{ "section": "...", "before": "...", "after": "...", "reason": "..." }] }`,

      10: `You are Dr. Q, finalizing QS research.
Topic: ${project.title}
All data: ${JSON.stringify(project.stage_data)}
User input: ${userPrompt || 'Generate final abstract and keywords'}

Generate a final abstract and keywords for the completed research.
Output JSON: { "final_abstract": "...", "keywords": ["..."], "word_count": 300 }`
    };

    const prompt = prompts[stage] || prompts[1];

    let result;
    try {
      const raw = await callAI(prompt, { temperature: 0.4, maxTokens: 3000 });
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (err) {
      logger.warn('AI assist failed:', err.message);
      result = { message: 'AI assist is temporarily unavailable. Please try again.' };
    }

    return res.json(success(`AI assist for Stage ${stage}: ${STAGE_NAMES[stage]}`, result));
  } catch (err) { next(err); }
};

// ─── Literature Sources ───────────────────────────────────────

exports.getSources = async (req, res, next) => {
  try {
    const { search, type, region, year_from, year_to } = req.query;
    let q = supabase.from('research_sources').select('*');
    if (search) q = q.or(`title.ilike.%${search}%,abstract.ilike.%${search}%,keywords.cs.{${search}}`);
    if (type) q = q.eq('source_type', type);
    if (region) q = q.eq('region', region);
    if (year_from) q = q.gte('year', year_from);
    if (year_to) q = q.lte('year', year_to);
    q = q.order('year', { ascending: false }).limit(50);

    const { data: sources, err } = await q;
    if (err) throw err;
    return res.json(success('Sources fetched', { sources }));
  } catch (err) { next(err); }
};

exports.addSource = async (req, res, next) => {
  try {
    const { title, authors, year, source_type, url, doi, abstract, keywords, region } = req.body;
    if (!title || !source_type) {
      return res.status(400).json(error('title and source_type are required'));
    }

    const { data: source, err } = await supabase.from('research_sources').insert({
      title, authors: authors || [], year, source_type,
      url, doi, abstract, keywords: keywords || [], region: region || 'Nigeria',
      added_by: req.user.id
    }).select('*').single();

    if (err) throw err;
    return res.status(201).json(success('Source added', source));
  } catch (err) { next(err); }
};

// ─── Cost Data ────────────────────────────────────────────────

exports.getCostData = async (req, res, next) => {
  try {
    const { item, region, project_type, year } = req.query;
    let q = supabase.from('research_cost_data').select('*');
    if (item) q = q.ilike('item_description', `%${item}%`);
    if (region) q = q.eq('region', region);
    if (project_type) q = q.eq('project_type', project_type);
    if (year) q = q.gte('date_collected', `${year}-01-01`).lte('date_collected', `${year}-12-31`);
    q = q.order('date_collected', { ascending: false }).limit(100);

    const { data: costs, err } = await q;
    if (err) throw err;
    return res.json(success('Cost data fetched', { costs }));
  } catch (err) { next(err); }
};

exports.addCostData = async (req, res, next) => {
  try {
    const { item_description, unit, rate_ngn, region, state, source, project_type, tags } = req.body;
    if (!item_description || !unit || !rate_ngn || !region) {
      return res.status(400).json(error('item_description, unit, rate_ngn, and region are required'));
    }

    const { data: cost, err } = await supabase.from('research_cost_data').insert({
      item_description, unit, rate_ngn, region, state,
      source: source || 'user_boq', project_type,
      tags: tags || [], added_by: req.user.id
    }).select('*').single();

    if (err) throw err;
    return res.status(201).json(success('Cost data added', cost));
  } catch (err) { next(err); }
};

exports.getCostAggregate = async (req, res, next) => {
  try {
    const { item } = req.query;
    if (!item) return res.status(400).json(error('item query parameter is required'));

    const { data: costs, err } = await supabase.from('research_cost_data')
      .select('region, rate_ngn, date_collected, confidence')
      .ilike('item_description', `%${item}%`)
      .order('date_collected', { ascending: false });

    if (err) throw err;

    // Aggregate by region
    const byRegion = {};
    for (const c of costs || []) {
      if (!byRegion[c.region]) byRegion[c.region] = { rates: [], latest: null };
      byRegion[c.region].rates.push(c.rate_ngn);
      if (!byRegion[c.region].latest) byRegion[c.region].latest = c;
    }

    const aggregated = Object.entries(byRegion).map(([region, data]) => ({
      region,
      avg_rate: Math.round(data.rates.reduce((s, v) => s + v, 0) / data.rates.length),
      min_rate: Math.min(...data.rates),
      max_rate: Math.max(...data.rates),
      count: data.rates.length,
      latest_date: data.latest?.date_collected
    }));

    return res.json(success('Cost aggregate', { item, regions: aggregated }));
  } catch (err) { next(err); }
};

// ─── Templates ────────────────────────────────────────────────

exports.getTemplates = async (req, res, next) => {
  try {
    const { data: templates, err } = await supabase.from('research_templates')
      .select('*').order('name');
    if (err) throw err;
    return res.json(success('Templates fetched', { templates }));
  } catch (err) { next(err); }
};

// ─── Collaborations ───────────────────────────────────────────

exports.inviteCollaborator = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;

    const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return res.status(404).json(error('User not found'));

    const { data: collab, err } = await supabase.from('research_collaborations').insert({
      project_id: id, user_id: user.id, role: role || 'editor'
    }).select('*').single();

    if (err) throw err;
    return res.status(201).json(success('Collaborator invited', collab));
  } catch (err) { next(err); }
};

// ─── Research Subscription ─────────────────────────────────────

const RESEARCH_BILLING_NGN = {
  weekly: 3000,
  monthly: 11400,
  annual: 140400,
};

exports.checkResearchAccess = async (userId) => {
  const { data } = await supabase
    .from('research_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();
  return !!data;
};

exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const hasAccess = await exports.checkResearchAccess(req.user.id);

    const { data: sub } = await supabase
      .from('research_subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.json(success('Research subscription status', {
      active: hasAccess,
      subscription: sub || null,
    }));
  } catch (err) { next(err); }
};

exports.subscribe = async (req, res, next) => {
  try {
    const { payment_method = 'card', billing_cycle = 'weekly' } = req.body;
    const cycleAmountNgn = RESEARCH_BILLING_NGN[billing_cycle] || 3000;

    const hasAccess = await exports.checkResearchAccess(req.user.id);
    if (hasAccess) {
      return res.status(409).json(error('You already have an active research subscription'));
    }

    if (payment_method === 'bank_transfer') {
      const { referenceNote } = req.body;
      const { data: submission, error: insertErr } = await supabase
        .from('direct_payment_submissions')
        .insert({
          user_id: req.user.id,
          plan_name: 'research_weekly',
          billing_cycle,
          amount_ngn: cycleAmountNgn,
          reference_note: referenceNote || null,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (insertErr) throw insertErr;
      return res.status(201).json(success('Payment submitted for verification', {
        id: submission.id,
        status: submission.status,
        amountNgn: submission.amount_ngn,
        billing_cycle,
        message: 'Your payment will be verified within 24 hours.',
      }));
    }

    const { data: user } = await supabase.from('users').select('email, country').eq('id', req.user.id).single();
    if (!user?.email) return res.status(400).json(error('User email is required'));

    const userCountry = user.country || 'NG';
    let paymentResult;
    try {
      paymentResult = await initializePayment({
        email: user.email,
        amountNGN: cycleAmountNgn,
        country: userCountry,
        metadata: {
          user_id: req.user.id,
          product_type: 'research_subscription',
          billing_cycle,
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: `QS Research ${billing_cycle}` }
          ]
        },
        callbackUrl: `${process.env.FRONTEND_URL}/research`,
        txPrefix: 'research'
      });
    } catch (payErr) {
      const providerMsg = payErr?.response?.data?.message || payErr?.response?.data?.msg || payErr.message;
      return res.status(400).json(error(`Payment initialization failed: ${providerMsg}`));
    }

    return res.json(success('Payment initiated', {
      gateway: paymentResult.gateway,
      authorization_url: paymentResult.authorization_url,
      reference: paymentResult.reference,
      amount: cycleAmountNgn,
      billing_cycle
    }));
  } catch (err) { next(err); }
};

exports.cancelSubscription = async (req, res, next) => {
  try {
    const { data: sub } = await supabase
      .from('research_subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!sub) return res.status(404).json(error('No active research subscription found'));

    const { error: updateErr } = await supabase
      .from('research_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', sub.id);

    if (updateErr) throw updateErr;

    return res.json(success('Research subscription cancelled. Access continues until expiry.', {
      expires_at: sub.expires_at,
    }));
  } catch (err) { next(err); }
};
