const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const paymentSettingsController = require('./paymentSettingsController');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

const ACADEMY_WEEKLY_AMOUNT = 200000; // ₦2,000 in kobo
const ACADEMY_MONTHLY_AMOUNT = 760000; // ₦7,600 in kobo (5% discount on 4 weeks)
const ACADEMY_ANNUAL_AMOUNT = 9360000; // ₦93,600 in kobo (10% discount on 52 weeks)

const ACADEMY_BILLING_AMOUNTS = {
  weekly: ACADEMY_WEEKLY_AMOUNT,
  monthly: ACADEMY_MONTHLY_AMOUNT,
  annual: ACADEMY_ANNUAL_AMOUNT,
};

const ACADEMY_BILLING_NGN = {
  weekly: 2000,
  monthly: 7600,
  annual: 93600,
};

// ─── Helpers ───────────────────────────────────────────────────

async function checkAcademyAccess(userId) {
  const { data } = await supabase
    .from('academy_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();
  return !!data;
}

// ─── Subscription Status ───────────────────────────────────────

exports.getStatus = async (req, res, next) => {
  try {
    const hasAccess = await checkAcademyAccess(req.user.id);

    const { data: sub } = await supabase
      .from('academy_subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check admission test completion
    // Note: admission_completed is true if user has taken the test, regardless of score
    // The admission test is an assessment tool, not a gate
    const { data: admission } = await supabase
      .from('academy_admission_tests')
      .select('id, status, score, passed, correct_count, total_questions')
      .eq('user_id', req.user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check strengths/weaknesses profile — return full data for frontend
    const { data: profile } = await supabase
      .from('academy_profiles')
      .select('id, strengths, weaknesses, goals')
      .eq('user_id', req.user.id)
      .maybeSingle();

    return res.json(success('Academy status', {
      active: hasAccess,
      subscription_active: hasAccess,
      subscription: sub || null,
      admission_completed: !!admission, // True if test was taken, regardless of score
      admission_score: admission?.score || null,
      admission_passed: admission?.passed || false,
      correct_count: admission?.correct_count || null,
      total_questions: admission?.total_questions || null,
      profile_completed: !!profile,
      profile: profile ? {
        strengths: profile.strengths || [],
        weaknesses: profile.weaknesses || [],
        goals: profile.goals || [],
      } : null,
    }));
  } catch (err) { next(err); }
};

// ─── Subscribe (Paystack or Bank Transfer) ────────────────────

exports.subscribe = async (req, res, next) => {
  try {
    const { email, payment_method, billing_cycle = 'weekly' } = req.body;
    const cycleAmount = ACADEMY_BILLING_AMOUNTS[billing_cycle] || ACADEMY_WEEKLY_AMOUNT;
    const cycleAmountNgn = ACADEMY_BILLING_NGN[billing_cycle] || 2000;

    // Check if already has active subscription
    const hasAccess = await checkAcademyAccess(req.user.id);
    if (hasAccess) {
      return res.status(409).json(error('You already have an active academy subscription'));
    }

    // Bank transfer path
    if (payment_method === 'bank_transfer') {
      const { referenceNote } = req.body;

      const { data: submission, error: insertErr } = await supabase
        .from('direct_payment_submissions')
        .insert({
          user_id: req.user.id,
          plan_name: 'academy_weekly',
          billing_interval: billing_cycle,
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
        planName: submission.plan_name,
        amountNgn: submission.amount_ngn,
        billing_cycle,
        submittedAt: submission.submitted_at,
        message: 'Your payment will be verified within 24 hours.',
      }));
    }

    // Paystack path (default)
    if (!email) return res.status(400).json(error('Email is required'));

    let paystackRes;
    try {
      paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
        email,
        amount: cycleAmount,
        currency: 'NGN',
        metadata: {
          user_id: req.user.id,
          product_type: 'academy_subscription',
          billing_cycle,
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: `QS Academy ${billing_cycle}` }
          ]
        },
        callback_url: `${process.env.FRONTEND_URL}/academy`
      }, { headers: paystackHeaders() });
    } catch (paystackErr) {
      const providerMsg = paystackErr?.response?.data?.message || paystackErr.message;
      return res.status(400).json(error(`Payment initialization failed: ${providerMsg}`));
    }

    return res.json(success('Payment initiated', {
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference,
      amount: cycleAmountNgn,
      billing_cycle
    }));
  } catch (err) { next(err); }
};

// ─── Bank Transfer Settings ───────────────────────────────────

exports.getBankTransferSettings = paymentSettingsController.getBankTransferSettings;

// ─── Profile ───────────────────────────────────────────────────

exports.getProfile = async (req, res, next) => {
  try {
    const { data: profile } = await supabase
      .from('academy_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    return res.json(success('Academy profile', { profile: profile || null }));
  } catch (err) { next(err); }
};

exports.saveProfile = async (req, res, next) => {
  try {
    const { strengths, weaknesses, goals } = req.body;

    const { data: existing } = await supabase
      .from('academy_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const payload = {
      user_id: req.user.id,
      strengths,
      weaknesses,
      goals: goals || [],
      updated_at: new Date().toISOString()
    };

    let profile;
    if (existing) {
      const { data, error: updateErr } = await supabase
        .from('academy_profiles')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      profile = data;
    } else {
      payload.created_at = new Date().toISOString();
      const { data, error: insertErr } = await supabase
        .from('academy_profiles')
        .insert(payload)
        .select()
        .single();
      if (insertErr) throw insertErr;
      profile = data;
    }

    return res.json(success('Profile saved', { profile }));
  } catch (err) { next(err); }
};

// ─── Admission Test ────────────────────────────────────────────

exports.startAdmission = async (req, res, next) => {
  try {
    // Check if already passed admission
    const { data: existingResult } = await supabase
      .from('academy_admission_tests')
      .select('id, score, passed')
      .eq('user_id', req.user.id)
      .eq('passed', true)
      .maybeSingle();

    if (existingResult) {
      return res.json(success('Admission already passed', { passed: true, score: existingResult.score }));
    }

    // Check for in-progress test — resume or clean up stale ones
    const { data: inProgress } = await supabase
      .from('academy_admission_tests')
      .select('id, questions, started_at')
      .eq('user_id', req.user.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inProgress) {
      // Check if stale (older than 30 minutes)
      const startedAt = new Date(inProgress.started_at).getTime();
      const now = Date.now();
      const thirtyMinMs = 30 * 60 * 1000;

      if (now - startedAt > thirtyMinMs) {
        // Stale — mark as expired and allow new test
        await supabase
          .from('academy_admission_tests')
          .update({ status: 'expired' })
          .eq('id', inProgress.id);
      } else {
        // Fresh — return existing questions for continuation
        const questions = inProgress.questions || [];
        const safeQuestions = questions.map((q, idx) => ({
          index: idx,
          question: q.question,
          options: q.options,
          topic: q.topic,
          difficulty: q.difficulty
        }));

        return res.json(success('Resuming admission test', {
          test_id: inProgress.id,
          questions: safeQuestions,
          time_limit_minutes: 30,
          total_questions: questions.length,
          resumed: true
        }));
      }
    }

    // Get user's profile for personalized questions
    const { data: profile } = await supabase
      .from('academy_profiles')
      .select('strengths, weaknesses')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const strengths = profile?.strengths || [];
    const weaknesses = profile?.weaknesses || [];

    // Get previous test topics to avoid repetition
    const { data: prevTests } = await supabase
      .from('academy_admission_tests')
      .select('questions')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const previousTopics = [];
    if (prevTests) {
      prevTests.forEach(test => {
        if (test.questions) {
          test.questions.forEach(q => {
            if (q.topic && !previousTopics.includes(q.topic)) {
              previousTopics.push(q.topic);
            }
          });
        }
      });
    }

    // Use AI to generate 7 QS-domain questions — deeply personalized
    const { buildUserContext, SYSTEM_PROMPTS } = require('../services/aiService');
    const userContext = await buildUserContext(req.user.id);

    const personalizedContext = `USER CONTEXT:\n${userContext}

STUDENT PROFILE:
- Strengths: ${strengths.length ? strengths.join(', ') : 'Not yet assessed'}
- Weaknesses: ${weaknesses.length ? weaknesses.join(', ') : 'Not yet assessed'}
${previousTopics.length ? `\nTOPICS ALREADY COVERED IN PREVIOUS ATTEMPTS (AVOID REPEATING THESE):\n${previousTopics.join(', ')}` : ''}

Generate exactly 7 questions. PRIORITIZE weakness areas (at least 5 of 7). Include 1-2 strength verification questions.
Topics to draw from: Nigerian QS standards, SMM7, NRM2, building measurement, cost estimation, BOQ preparation, construction materials, contracts & procurement, claims & variation, valuation, construction law, project management.`;

    const prompt = `${SYSTEM_PROMPTS.admissionTest || 'Generate 7 MCQ questions for a Nigerian QS admission test. Return JSON array.'}\n\n${personalizedContext}`;

    // Try AI generation, fall back to curated questions
    let questions;
    try {
      const { callAI } = require('../services/aiService');
        const raw = await callAI(prompt, { temperature: 0.8 });
        if (raw) {
          let clean = raw.trim();
          clean = clean.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
          const parsed = JSON.parse(clean.trim());
        if (Array.isArray(parsed) && parsed.length === 7) {
          // Sanitize questions: strip leading numbers from question text
          questions = parsed.map(q => ({
            ...q,
            question: (q.question || '').replace(/^\d+\.\s*/, '').trim(),
            // Ensure correct_answer is a single letter
            correct_answer: extractAnswerLetter(q.correct_answer)
          }));
        }
      }
    } catch (aiErr) {
      logger.warn('AI admission question generation failed, using fallback', { error: aiErr.message });
    }

    // Fallback: curated QS questions
    if (!questions || questions.length !== 7) {
      questions = generateFallbackAdmissionQuestions(weaknesses);
    }

    // Store the test
    const { data: test, error: insertErr } = await supabase
      .from('academy_admission_tests')
      .insert({
        user_id: req.user.id,
        questions,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Return questions without correct answers
    const safeQuestions = questions.map((q, idx) => ({
      index: idx,
      question: q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty
    }));

    return res.json(success('Admission test started', {
      test_id: test.id,
      questions: safeQuestions,
      time_limit_minutes: 30,
      total_questions: 7
    }));
  } catch (err) { next(err); }
};

exports.submitAdmission = async (req, res, next) => {
  try {
    const { answers, test_id } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json(error('answers array is required'));
    }

    // Find the test
    let testQuery = supabase
      .from('academy_admission_tests')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'in_progress');

    if (test_id) {
      testQuery = testQuery.eq('id', test_id);
    }

    const { data: test } = await testQuery.order('created_at', { ascending: false }).limit(1).single();

    if (!test) {
      return res.status(404).json(error('No in-progress admission test found'));
    }

    // Score the test — build a lookup by question_index for correct matching
    const questions = test.questions || [];
    const answerMap = {};
    answers.forEach(a => {
      // Normalize key to number for consistent lookup
      const key = Number(a.question_index);
      if (!isNaN(key)) {
        answerMap[key] = a.answer;
      }
    });

    // Helper: extract letter from option text (e.g., "B. 10 blocks/m²" → "B", "Option B" → "B")
    const extractLetter = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val).trim();
      if (!s) return '';
      // If it's already a single letter A-F, return it (case-insensitive)
      if (/^[A-F]$/i.test(s)) return s.toUpperCase();
      // Try to extract letter from patterns like "B. ...", "B. ...", "Option B", "(B)", "[B]"
      const match = s.match(/^\(?\[?\s*([A-F])\s*\)?\]?[.:\s)/]/i) || s.match(/option\s+([A-F])/i);
      if (match) return match[1].toUpperCase();
      // Last resort: check if starts with A-F followed by non-alpha
      const firstLetterMatch = s.match(/^([A-F])[^a-zA-Z]/i);
      return firstLetterMatch ? firstLetterMatch[1].toUpperCase() : '';
    };

    let correctCount = 0;
    const results = questions.map((q, idx) => {
      const rawAnswer = answerMap[idx] || '';
      const userAnswer = extractLetter(rawAnswer);
      const correctLetter = extractLetter(q.correct_answer);
      const isCorrect = userAnswer !== '' && correctLetter !== '' && userAnswer === correctLetter;
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        user_answer: rawAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation,
        topic: q.topic
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 60; // 60% pass mark

    // Update test record
    const { error: updateErr } = await supabase
      .from('academy_admission_tests')
      .update({
        answers,
        score,
        passed,
        correct_count: correctCount,
        total_questions: questions.length,
        status: 'completed',
        submitted_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', test.id);

    if (updateErr) throw updateErr;

    // Compute AI pathway recommendation based on weak topics
    let recommended_pathway = null;
    const wrongTopics = results.filter(r => !r.is_correct && r.topic).map(r => r.topic);
    if (wrongTopics.length > 0) {
      const topicToPathway = {
        'measurement': { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Improve your measurement & quantification skills' },
        'boq': { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Strengthen your BOQ preparation' },
        'estimation': { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Build stronger cost estimation foundations' },
        'cost': { slug: 'commercial-management', name: 'Construction Commercial Management', focus_area: 'Develop your cost management expertise' },
        'valuation': { slug: 'commercial-management', name: 'Construction Commercial Management', focus_area: 'Master valuation and financial control' },
        'contract': { slug: 'dispute-resolution', name: 'Construction Dispute Resolution', focus_area: 'Strengthen contract administration knowledge' },
        'law': { slug: 'dispute-resolution', name: 'Construction Dispute Resolution', focus_area: 'Build your construction law foundation' },
        'dispute': { slug: 'dispute-resolution', name: 'Construction Dispute Resolution', focus_area: 'Develop dispute resolution skills' },
        'project': { slug: 'project-management', name: 'Construction Project Management', focus_area: 'Enhance your project management capabilities' },
        'management': { slug: 'project-management', name: 'Construction Project Management', focus_area: 'Build core management competencies' },
        'technology': { slug: 'digital-construction', name: 'QS Technology & Digital Construction', focus_area: 'Embrace digital tools and innovation' },
        'bim': { slug: 'digital-construction', name: 'QS Technology & Digital Construction', focus_area: 'Develop your BIM and digital skills' },
        'building': { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Strengthen building technology knowledge' },
        'material': { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Learn construction materials and properties' },
        'professional': { slug: 'commercial-management', name: 'Construction Commercial Management', focus_area: 'Develop professional practice skills' },
        'ethics': { slug: 'commercial-management', name: 'Construction Commercial Management', focus_area: 'Understand professional ethics and standards' },
        'real_estate': { slug: 'real-estate-advisory', name: 'Real Estate & Property Advisory', focus_area: 'Explore property valuation and advisory' },
        'property': { slug: 'real-estate-advisory', name: 'Real Estate & Property Advisory', focus_area: 'Build property market knowledge' },
      };

      // Find most frequent weak topic category
      const topicCounts = {};
      wrongTopics.forEach(t => {
        const lower = t.toLowerCase();
        Object.keys(topicToPathway).forEach(key => {
          if (lower.includes(key)) {
            const pw = topicToPathway[key];
            topicCounts[pw.slug] = topicCounts[pw.slug] || { ...pw, count: 0 };
            topicCounts[pw.slug].count++;
          }
        });
      });

      const sorted = Object.values(topicCounts).sort((a, b) => b.count - a.count);
      if (sorted.length > 0) {
        recommended_pathway = { slug: sorted[0].slug, name: sorted[0].name, focus_area: sorted[0].focus_area };
      }
    }

    // Default recommendation if no weak topics matched
    if (!recommended_pathway) {
      recommended_pathway = { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Build a strong foundation in quantity surveying fundamentals' };
    }

    // Admission test is an assessment tool, not a gate
    // Always allow the user to proceed with their recommended pathway
    const responseMessage = passed 
      ? 'Congratulations! You passed the admission test.' 
      : 'Assessment complete! Dr. Q has analyzed your responses and recommended a personalized learning pathway.';

    return res.json(success(responseMessage, {
      test_id: test.id,
      score,
      passed,
      correct_count: correctCount,
      total_questions: questions.length,
      pass_mark: 60,
      redirect_to: '/academy/pathways', // Always redirect to pathways
      recommended_pathway,
      results
    }));
  } catch (err) { next(err); }
};

exports.getAdmissionResult = async (req, res, next) => {
  try {
    const { data: test } = await supabase
      .from('academy_admission_tests')
      .select('id, score, passed, correct_count, total_questions, status, started_at, submitted_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!test) {
      return res.status(404).json(error('No admission test found'));
    }

    return res.json(success('Admission result', { test }));
  } catch (err) { next(err); }
};

// ─── Pathways ──────────────────────────────────────────────────

exports.getPathways = async (req, res, next) => {
  try {
    const { data: pathways, error: err } = await supabase
      .from('academy_pathways')
      .select('*')
      .eq('is_published', true)
      .order('sort_order');

    if (err) throw err;

    // Enrich with actual module counts from academy_modules
    const enriched = await Promise.all((pathways || []).map(async (p) => {
      const { count } = await supabase
        .from('academy_modules')
        .select('id', { count: 'exact', head: true })
        .eq('pathway_slug', p.slug)
        .eq('is_published', true);
      return { ...p, module_count: count || 0 };
    }));

    return res.json(success('Pathways', { pathways: enriched }));
  } catch (err) { next(err); }
};

exports.getPathwayDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const { data: pathway, error: err } = await supabase
      .from('academy_pathways')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (err || !pathway) return res.status(404).json(error('Pathway not found'));

    // Fetch modules for this pathway, grouped by level
    // Include content and questions for direct module delivery
    const { data: modules } = await supabase
      .from('academy_modules')
      .select('id, level, title, description, module_type, order_index, duration_minutes, points, resource_id, content, questions')
      .eq('pathway_slug', slug)
      .eq('is_published', true)
      .order('level')
      .order('order_index');

    // Group modules by level
    const levelsMap = {};
    (modules || []).forEach(m => {
      if (!levelsMap[m.level]) levelsMap[m.level] = [];
      levelsMap[m.level].push(m);
    });

    // Fetch user's module progress for this pathway
    const { data: enrollment } = await supabase
      .from('academy_enrollments')
      .select('id, enrolled_at')
      .eq('user_id', req.user.id)
      .eq('pathway_id', pathway.id)
      .maybeSingle();

    let completedModules = [];
    if (enrollment) {
      const { data: progress } = await supabase
        .from('academy_module_progress')
        .select('module_id, completed')
        .eq('user_id', req.user.id)
        .eq('pathway_id', pathway.id)
        .eq('completed', true);
      completedModules = (progress || []).map(p => p.module_id);
    }

    // Enrich modules with completion status
    const enrichedLevels = {};
    Object.keys(levelsMap).forEach(level => {
      enrichedLevels[level] = levelsMap[level].map(m => ({
        ...m,
        completed: completedModules.includes(m.id)
      }));
    });

    return res.json(success('Pathway detail', {
      pathway: { ...pathway, module_count: (modules || []).length },
      levels: enrichedLevels,
      enrolled: !!enrollment,
      enrolled_at: enrollment?.enrolled_at || null,
      completed_count: completedModules.length
    }));
  } catch (err) { next(err); }
};

exports.enrollPathway = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Check academy access
    const hasAccess = await checkAcademyAccess(req.user.id);
    if (!hasAccess) {
      return res.status(403).json(error('Active academy subscription required to enroll', { code: 'ACADEMY_SUBSCRIPTION_REQUIRED' }));
    }

    const { data: pathway } = await supabase
      .from('academy_pathways')
      .select('id')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (!pathway) return res.status(404).json(error('Pathway not found'));

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('academy_enrollments')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('pathway_id', pathway.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json(error('Already enrolled in this pathway'));
    }

    const { data: enrollment, error: insertErr } = await supabase
      .from('academy_enrollments')
      .insert({
        user_id: req.user.id,
        pathway_id: pathway.id,
        enrolled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.json(success('Enrolled successfully', { enrollment }));
  } catch (err) { next(err); }
};

exports.getPathwayProgress = async (req, res, next) => {
  try {
    const { data: enrollments, error: err } = await supabase
      .from('academy_enrollments')
      .select('id, enrolled_at, pathway:academy_pathways(id, title, slug)')
      .eq('user_id', req.user.id)
      .order('enrolled_at', { ascending: false });

    if (err) throw err;

    // Get progress for each enrollment
    const progressData = await Promise.all((enrollments || []).map(async (enrollment) => {
      const pathwayId = enrollment.pathway?.id;
      const pathwaySlug = enrollment.pathway?.slug;

      // Count modules from academy_modules (authoritative source)
      const { count: totalModules } = await supabase
        .from('academy_modules')
        .select('id', { count: 'exact', head: true })
        .eq('pathway_slug', pathwaySlug)
        .eq('is_published', true);

      const { data: progress } = await supabase
        .from('academy_module_progress')
        .select('module_id, completed')
        .eq('user_id', req.user.id)
        .eq('pathway_id', pathwayId);

      const completedCount = (progress || []).filter(p => p.completed).length;
      const total = totalModules || 0;

      return {
        enrollment_id: enrollment.id,
        pathway: { ...enrollment.pathway, module_count: total },
        enrolled_at: enrollment.enrolled_at,
        completed_modules: completedCount,
        total_modules: total,
        progress_percent: total > 0 ? Math.round((completedCount / total) * 100) : 0
      };
    }));

    return res.json(success('Pathway progress', { progress: progressData }));
  } catch (err) { next(err); }
};

// ─── Resources ─────────────────────────────────────────────────

exports.completeModule = async (req, res, next) => {
  try {
    const { pathway_slug, module_id } = req.body;

    if (!pathway_slug || !module_id) {
      return res.status(400).json(error('pathway_slug and module_id are required'));
    }

    // Look up pathway by slug
    const { data: pathway } = await supabase
      .from('academy_pathways')
      .select('id, module_count')
      .eq('slug', pathway_slug)
      .eq('is_published', true)
      .single();

    if (!pathway) return res.status(404).json(error('Pathway not found'));

    // Verify enrollment
    const { data: enrollment } = await supabase
      .from('academy_enrollments')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('pathway_id', pathway.id)
      .maybeSingle();

    if (!enrollment) {
      return res.status(403).json(error('You are not enrolled in this pathway'));
    }

    // Check if already completed
    const { data: existing } = await supabase
      .from('academy_module_progress')
      .select('id, completed')
      .eq('user_id', req.user.id)
      .eq('pathway_id', pathway.id)
      .eq('module_id', module_id)
      .maybeSingle();

    if (existing?.completed) {
      return res.json(success('Module already completed', { already_completed: true }));
    }

    // Upsert module progress
    if (existing) {
      const { error: updateErr } = await supabase
        .from('academy_module_progress')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('academy_module_progress')
        .insert({
          user_id: req.user.id,
          pathway_id: pathway.id,
          module_id,
          completed: true,
          completed_at: new Date().toISOString()
        });
      if (insertErr) throw insertErr;
    }

    // Get updated progress count
    const { data: allProgress } = await supabase
      .from('academy_module_progress')
      .select('module_id, completed')
      .eq('user_id', req.user.id)
      .eq('pathway_id', pathway.id)
      .eq('completed', true);

    const completedCount = (allProgress || []).length;
    const totalModules = pathway.module_count || 0;
    const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

    return res.json(success('Module completed', {
      module_id,
      completed_modules: completedCount,
      total_modules: totalModules,
      progress_percent: progressPercent
    }));
  } catch (err) { next(err); }
};

exports.getResources = async (req, res, next) => {
  try {
    const { pathway, category, level, type, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('academy_resources')
      .select('*', { count: 'exact' })
      .eq('is_published', true);

    if (pathway) query = query.eq('pathway_slug', pathway);
    if (category) query = query.eq('category', category);
    if (level) query = query.eq('level', level);
    if (type) query = query.eq('resource_type', type);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1).order('created_at', { ascending: false });

    const { data: resources, count, error: err } = await query;
    if (err) throw err;

    return res.json(success('Resources', {
      resources: resources || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (err) { next(err); }
};

exports.getResource = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: resource, error: err } = await supabase
      .from('academy_resources')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (err || !resource) return res.status(404).json(error('Resource not found'));

    // Track view (fire and forget)
    supabase.from('academy_resource_views').insert({
      resource_id: id,
      user_id: req.user.id,
      viewed_at: new Date().toISOString()
    }).then();

    return res.json(success('Resource', { resource }));
  } catch (err) { next(err); }
};

// ─── Contests ──────────────────────────────────────────────────

exports.createContest = async (req, res, next) => {
  try {
    const {
      title, description, topic, contest_type = 'group',
      question_count = 10, time_limit = 10, difficulty = 'medium',
      opponent, scheduled_at, duration_minutes = 30, max_participants
    } = req.body;

    // At least title or topic must be provided
    const contestTitle = (title || topic || '').trim();
    if (!contestTitle) {
      return res.status(400).json(error('Either title or topic is required'));
    }
    
    const time_limit_seconds = (time_limit || 10) * 60;

    // Scheduled contests require Pro+ plan
    if (scheduled_at) {
      const { data: user } = await supabase
        .from('users')
        .select('plan_id, subscription_plans(name)')
        .eq('id', req.user.id)
        .single();

      const planName = user?.subscription_plans?.name || 'free';
      if (!['pro', 'enterprise'].includes(planName)) {
        return res.status(403).json(error('Scheduled contests require a Pro or Enterprise plan', { code: 'PLAN_UPGRADE_REQUIRED' }));
      }
    }

    try {
      const qCount = parseInt(question_count) || 10;
      const contestStatus = scheduled_at ? 'scheduled' : 'pending';

      const { data: contest, error: insertErr } = await supabase
        .from('academy_contests')
        .insert({
          creator_id: req.user.id,
          title: contestTitle,
          description: description || '',
          topic: topic || contestTitle,
          contest_type,
          question_count: qCount,
          time_limit_seconds: parseInt(time_limit_seconds) || 600,
          difficulty: difficulty || 'medium',
          scheduled_at: scheduled_at || null,
          duration_minutes: parseInt(duration_minutes) || 30,
          max_participants: max_participants ? parseInt(max_participants) : null,
          status: contestStatus,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertErr) {
        logger.error('Database error during contest creation:', insertErr);
        throw insertErr;
      }

      // Auto-join the creator as a participant
      await supabase.from('academy_contest_participants').insert({
        contest_id: contest.id,
        user_id: req.user.id,
        joined_at: new Date().toISOString()
      });

      // Generate questions synchronously for immediate contests
      // Contest only activates once questions are ready (no race condition)
      if (contestStatus !== 'scheduled') {
        try {
          const questions = await generateContestQuestions(contest.id, contestTitle, qCount, difficulty || 'medium');
          if (questions && questions.length > 0) {
            await supabase
              .from('academy_contests')
              .update({ status: 'active' })
              .eq('id', contest.id);
          }
        } catch (err) {
          logger.error('Contest question generation failed:', { contest_id: contest.id, error: err.message });
          // Contest stays 'pending' — creator can retry or it will be cleaned up
        }
      }

      // Handle duel opponent invitation
      if (contest_type === 'duel' && opponent) {
        const { data: opponentUser } = await supabase
          .from('users')
          .select('id, name, email')
          .or(`name.ilike.%${opponent}%,email.ilike.%${opponent}%`)
          .neq('id', req.user.id)
          .limit(1)
          .maybeSingle();

        if (opponentUser) {
          await supabase.from('academy_contest_participants').insert({
            contest_id: contest.id,
            user_id: opponentUser.id,
            status: 'invited',
            joined_at: new Date().toISOString()
          });
        }
      }

      return res.status(201).json(success('Contest created', { contest }));
    } catch (err) {
      logger.error('Contest creation failed:', err);
      next(err);
    }
  } catch (err) { next(err); }
};

exports.getContests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('academy_contests')
      .select('*, creator:users(name, email)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['active', 'scheduled', 'completed']);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1).order('created_at', { ascending: false });

    const { data: contests, count, error: err } = await query;
    if (err) throw err;

    return res.json(success('Contests', {
      contests: contests || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (err) { next(err); }
};

exports.getContestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: contest, error: err } = await supabase
      .from('academy_contests')
      .select('*, creator:users(name, email), participants:academy_contest_participants(user_id, status, joined_at, user:users(name, email))')
      .eq('id', id)
      .single();

    if (err || !contest) return res.status(404).json(error('Contest not found'));

    // Fetch questions (without correct answers for non-creators)
    const isCreator = contest.creator_id === req.user.id;
    const { data: questions } = await supabase
      .from('academy_contest_questions')
      .select(isCreator
        ? 'id, question_text, question_type, options, correct_answer, explanation, difficulty, sort_order'
        : 'id, question_text, question_type, options, difficulty, sort_order')
      .eq('contest_id', id)
      .order('sort_order');

    // Check if current user has joined and/or submitted
    const myParticipant = (contest.participants || []).find(p => p.user_id === req.user.id);
    const { data: mySubmission } = await supabase
      .from('academy_contest_submissions')
      .select('id, total_points, submitted_at')
      .eq('contest_id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    return res.json(success('Contest', {
      contest: {
        ...contest,
        questions: questions || [],
        joined: !!myParticipant,
        submitted: !!mySubmission,
        my_submission: mySubmission || null
      }
    }));
  } catch (err) { next(err); }
};

exports.joinContest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: contest } = await supabase
      .from('academy_contests')
      .select('*')
      .eq('id', id)
      .single();

    if (!contest) return res.status(404).json(error('Contest not found'));

    if (contest.status === 'completed') {
      return res.status(400).json(error('This contest has ended'));
    }

    if (contest.status === 'scheduled') {
      return res.status(400).json(error('This contest has not started yet'));
    }

    if (contest.status === 'pending') {
      return res.status(400).json(error('Contest questions are being prepared. Please try again shortly.'));
    }

    // Check max participants
    if (contest.max_participants) {
      const { count } = await supabase
        .from('academy_contest_participants')
        .select('id', { count: 'exact', head: true })
        .eq('contest_id', id);

      if (count >= contest.max_participants) {
        return res.status(409).json(error('Contest is full'));
      }
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from('academy_contest_participants')
      .select('id')
      .eq('contest_id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json(error('Already joined this contest'));
    }

    const { data: participant, error: insertErr } = await supabase
      .from('academy_contest_participants')
      .insert({
        contest_id: id,
        user_id: req.user.id,
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.json(success('Joined contest', { participant }));
  } catch (err) { next(err); }
};

exports.submitContest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json(error('answers array is required'));
    }

    // Get contest
    const { data: contest } = await supabase
      .from('academy_contests')
      .select('*')
      .eq('id', id)
      .single();

    if (!contest) return res.status(404).json(error('Contest not found'));

    if (contest.status === 'pending') {
      return res.status(400).json(error('Contest questions are still being prepared. Please try again shortly.'));
    }

    // Verify participation
    const { data: participant } = await supabase
      .from('academy_contest_participants')
      .select('id, joined_at')
      .eq('contest_id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json(error('You have not joined this contest'));
    }

    // Check if already submitted
    const { data: existingSubmission } = await supabase
      .from('academy_contest_submissions')
      .select('id')
      .eq('contest_id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existingSubmission) {
      return res.status(409).json(error('You have already submitted answers for this contest'));
    }

    // Get contest questions
    const { data: questions } = await supabase
      .from('academy_contest_questions')
      .select('*')
      .eq('contest_id', id)
      .order('sort_order');

    if (!questions || questions.length === 0) {
      return res.status(400).json(error('This contest has no questions'));
    }

    // Score with bonuses
    const timeSpentMinutes = contest.scheduled_at
      ? Math.max(0, (new Date() - new Date(participant.joined_at)) / 60000)
      : 0;
    const timeLimit = contest.duration_minutes || 30;

    let totalPoints = 0;
    let streak = 0;
    const detailedResults = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // Extract letter from user answer and correct answer for reliable comparison
      const userLetter = extractAnswerLetter(answers[i]?.answer || '');
      const correctLetter = extractAnswerLetter(q.correct_answer);
      const isCorrect = userLetter !== '' && correctLetter !== '' && userLetter === correctLetter;

      // Base points
      let points = 0;
      if (isCorrect) {
        const difficultyMultiplier = { easy: 1, medium: 1.5, hard: 2 }[q.difficulty] || 1;
        points = Math.round(10 * difficultyMultiplier);

        // Streak bonus
        streak++;
        if (streak >= 2) {
          points += 2 * streak;
        }
      } else {
        streak = 0;
      }

      totalPoints += points;

      detailedResults.push({
        question_id: q.id,
        user_answer: answers[i]?.answer || '',
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        points_earned: points,
        difficulty: q.difficulty
      });
    }

    // Time bonus: max(0, 10 - floor(time_spent / time_limit * 10))
    const timeBonus = Math.max(0, Math.floor(10 - (timeSpentMinutes / timeLimit) * 10));
    totalPoints += timeBonus;

    // Store submission
    const { data: submission, error: insertErr } = await supabase
      .from('academy_contest_submissions')
      .insert({
        contest_id: id,
        user_id: req.user.id,
        participant_id: participant.id,
        answers,
        total_points: totalPoints,
        time_bonus: timeBonus,
        time_spent_minutes: Math.round(timeSpentMinutes),
        detailed_results: detailedResults,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Award tokens (1 point = 1 token)
    await supabase.from('academy_tokens').insert({
      user_id: req.user.id,
      amount: totalPoints,
      source: 'contest',
      reference_id: id,
      created_at: new Date().toISOString()
    });

    return res.json(success('Contest submitted', {
      submission_id: submission.id,
      total_points: totalPoints,
      time_bonus: timeBonus,
      correct_count: detailedResults.filter(r => r.is_correct).length,
      total_questions: questions.length,
      tokens_earned: totalPoints
    }));
  } catch (err) { next(err); }
};

exports.getContestResults = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: contest } = await supabase
      .from('academy_contests')
      .select('id, title, status')
      .eq('id', id)
      .single();

    if (!contest) return res.status(404).json(error('Contest not found'));

    // Get leaderboard
    const { data: submissions, error: err } = await supabase
      .from('academy_contest_submissions')
      .select('id, total_points, time_bonus, time_spent_minutes, submitted_at, user:users(name, email)')
      .eq('contest_id', id)
      .order('total_points', { ascending: false })
      .limit(100);

    if (err) throw err;

    // Get user's submission
    const { data: mySubmission } = await supabase
      .from('academy_contest_submissions')
      .select('id, total_points, time_bonus, time_spent_minutes, submitted_at, detailed_results')
      .eq('contest_id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    return res.json(success('Contest results', {
      contest,
      leaderboard: (submissions || []).map((s, idx) => ({
        rank: idx + 1,
        user: s.user,
        total_points: s.total_points,
        time_bonus: s.time_bonus,
        submitted_at: s.submitted_at
      })),
      my_submission: mySubmission || null
    }));
  } catch (err) { next(err); }
};

// ─── Tokens ────────────────────────────────────────────────────

exports.getTokens = async (req, res, next) => {
  try {
    // Calculate total balance
    const { data: tokens } = await supabase
      .from('academy_tokens')
      .select('amount, source, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    const balance = (tokens || []).reduce((sum, t) => sum + (t.amount || 0), 0);

    return res.json(success('Token balance', {
      balance,
      history: tokens || []
    }));
  } catch (err) { next(err); }
};

// ─── Analytics ─────────────────────────────────────────────────

exports.getAnalytics = async (req, res, next) => {
  try {
    // Enrollment stats
    const { data: enrollments } = await supabase
      .from('academy_enrollments')
      .select('id, enrolled_at, pathway:academy_pathways(id, title, module_count)')
      .eq('user_id', req.user.id);

    // Module progress
    const { data: moduleProgress } = await supabase
      .from('academy_module_progress')
      .select('module_id, pathway_id, completed, completed_at')
      .eq('user_id', req.user.id);

    // Admission test
    const { data: admissionTest } = await supabase
      .from('academy_admission_tests')
      .select('score, passed, submitted_at')
      .eq('user_id', req.user.id)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Token balance
    const { data: tokens } = await supabase
      .from('academy_tokens')
      .select('amount, source')
      .eq('user_id', req.user.id);

    const totalTokens = (tokens || []).reduce((sum, t) => sum + (t.amount || 0), 0);

    // Contest wins
    const { data: contestResults } = await supabase
      .from('academy_contest_submissions')
      .select('total_points, contest:academy_contests(id)')
      .eq('user_id', req.user.id);

    // Get all submissions per contest to determine wins
    let contestsWon = 0;
    const contestIds = [...new Set((contestResults || []).map(c => c.contest?.id).filter(Boolean))];
    if (contestIds.length > 0) {
      for (const cid of contestIds) {
        const { data: allSubs } = await supabase
          .from('academy_contest_submissions')
          .select('total_points')
          .eq('contest_id', cid)
          .order('total_points', { ascending: false });
        if (allSubs && allSubs.length > 0) {
          const userSub = (contestResults || []).find(c => c.contest?.id === cid);
          if (userSub && userSub.total_points >= allSubs[0].total_points) {
            contestsWon++;
          }
        }
      }
    }

    // Compute current level from enrollments + module progress (not deprecated pathway_progress)
    // For each enrolled pathway, count completed modules and derive level from completion percentage
    let currentLevel = 1;
    for (const enrollment of (enrollments || [])) {
      const pathwayId = enrollment.pathway?.id;
      if (!pathwayId) continue;
      const totalMods = enrollment.pathway?.module_count || 10;
      const completedCount = (moduleProgress || []).filter(m => m.completed && m.pathway_id === pathwayId).length;
      const pct = totalMods > 0 ? (completedCount / totalMods) * 100 : 0;
      // Levels are 1-5, each 20% increment
      const level = Math.min(5, Math.floor(pct / 20) + 1);
      if (level > currentLevel) currentLevel = level;
    }

    // Compute recommended pathway from latest admission test
    let recommended_pathway = null;
    if (admissionTest && !admissionTest.passed && admissionTest.score !== null) {
      // Failed — recommend based on lowest-scoring areas
      recommended_pathway = { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Build a strong foundation in QS fundamentals' };
    } else if ((moduleProgress || []).length === 0 && (enrollments || []).length === 0) {
      // New user — recommend starting path
      recommended_pathway = { slug: 'technical-qs-practice', name: 'Technical QS Practice', focus_area: 'Begin your QS journey with core technical skills' };
    }

    // Study streak (simplified: count consecutive days with activity)
    const completedModules = (moduleProgress || []).filter(m => m.completed && m.completed_at);
    const studyDays = [...new Set(completedModules.map(m => m.completed_at?.split('T')[0]))].sort().reverse();

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);

    for (const day of studyDays) {
      const dayStr = day;
      const expected = checkDate.toISOString().split('T')[0];
      if (dayStr === expected) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dayStr < expected) {
        break;
      }
    }

    return res.json(success('Academy analytics', {
      enrollments_count: (enrollments || []).length,
      completed_modules: completedModules.length,
      total_modules_completed: completedModules.length,
      contests_participated: (contestResults || []).length,
      contests_won: contestsWon,
      total_contest_points: (contestResults || []).reduce((s, c) => s + (c.total_points || 0), 0),
      admission_test: admissionTest || null,
      tokens_earned: totalTokens,
      total_tokens: totalTokens,
      study_streak_days: streak,
      courses_completed: completedModules.length,
      current_level: currentLevel,
      recommended_pathway,
      recent_activity: []
    }));
  } catch (err) { next(err); }
};

// ─── Helpers (scoring) ──────────────────────────────────────────

/**
 * Extract a single letter (A-F) from various answer formats.
 * Handles: "B", "B.", "B. option text", "Option B", "(B)", etc.
 */
function extractAnswerLetter(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s) return '';
  // Already a single letter
  if (/^[A-F]$/i.test(s)) return s.toUpperCase();
  // Common patterns: "B. ...", "(B)", "[B]", "Option B"
  const match = s.match(/^\(?\[?\s*([A-F])\s*\)?\]?[.:\s)/]/i) || s.match(/option\s+([A-F])/i);
  if (match) return match[1].toUpperCase();
  // Last resort: first character if it's A-F
  const first = s.charAt(0).toUpperCase();
  return /^[A-F]$/.test(first) ? first : '';
}

// ─── Contest Question Generation ──────────────────────────────

async function generateContestQuestions(contestId, topic, count, difficulty) {
  const { callAI } = require('../services/aiService');

  const prompt = `You are Dr. Q, an expert Nigerian Quantity Surveying examiner creating quiz questions for a Knowledge Arena contest.

TOPIC: ${topic}
NUMBER OF QUESTIONS: ${count}
DIFFICULTY: ${difficulty}

INSTRUCTIONS:
1. Generate exactly ${count} UNIQUE, challenging multiple-choice questions about "${topic}".
2. Questions should be diverse and cover different aspects of the topic.
3. Use Nigerian QS context: Naira amounts, local materials, Nigerian standards (SMM7, NRM2, NESI, BOQ Institute).
4. Mix difficulty levels within the ${difficulty} range.
5. IMPORTANT: Do NOT prefix questions with numbers like "1." or "Q1." — questions will be numbered automatically.
6. IMPORTANT: The question field must contain ONLY the question text, not including any option letters or numbers.

OUTPUT: Valid JSON array with exactly ${count} objects. Each object must have:
{
  "question_text": "clear, specific question text WITHOUT any numbering prefix",
  "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
  "correct_answer": "B",
  "explanation": "brief explanation of correct answer",
  "difficulty": "easy|medium|hard"
}

The correct_answer must be a SINGLE LETTER (A, B, C, or D) matching the correct option.
Return ONLY the JSON array. No text outside the array.`;

  try {
    const raw = await callAI(prompt, { temperature: 0.8 });
    if (!raw) throw new Error('No AI response');

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== count) {
      throw new Error(`Expected ${count} questions, got ${parsed?.length || 0}`);
    }

    const questions = parsed.map((q, idx) => ({
      contest_id: contestId,
      question_text: (q.question_text || q.question || '').replace(/^\d+\.\s*/, '').trim(),
      question_type: 'mcq',
      options: q.options || [],
      correct_answer: extractAnswerLetter(q.correct_answer),
      explanation: q.explanation || '',
      difficulty: q.difficulty || difficulty,
      sort_order: idx
    }));

    const { error: insertErr } = await supabase
      .from('academy_contest_questions')
      .insert(questions);

    if (insertErr) throw insertErr;

    logger.info('Contest questions generated', { contest_id: contestId, count: questions.length });
    return questions;
  } catch (aiErr) {
    logger.warn('AI contest question generation failed, using fallback', { error: aiErr.message });

    // Fallback: generate simple topic-based questions
    const fallbackQuestions = Array.from({ length: count }, (_, idx) => ({
      contest_id: contestId,
      question_text: `In the context of "${topic}", which of the following is most relevant to Nigerian QS practice?`,
      question_type: 'mcq',
      options: [
        'A. SMM7 measurement standards',
        'B. NRM2 cost planning rules',
        'C. Nigerian BOQ preparation guidelines',
        'D. All of the above'
      ],
      correct_answer: 'D',
      explanation: `All listed standards and guidelines are relevant to ${topic} in Nigerian QS practice.`,
      difficulty: difficulty,
      sort_order: idx
    }));

    const { error: insertErr } = await supabase
      .from('academy_contest_questions')
      .insert(fallbackQuestions);

    if (insertErr) throw insertErr;

    return fallbackQuestions;
  }
}

// ─── Fallback Questions ────────────────────────────────────────

function generateFallbackAdmissionQuestions(weaknesses = []) {
  const allQuestions = [
    {
      question: 'What is the standard number of 9-inch sandcrete blocks per square metre of wall?',
      options: ['A. 8 blocks/m²', 'B. 10 blocks/m²', 'C. 12 blocks/m²', 'D. 14 blocks/m²'],
      correct_answer: 'B',
      explanation: '9-inch sandcrete blocks: 10 blocks/m² is the standard QS measurement.',
      difficulty: 'easy',
      topic: 'Building Measurement'
    },
    {
      question: 'What is the dry-to-wet volume conversion factor for concrete?',
      options: ['A. 1.35', 'B. 1.50', 'C. 1.54', 'D. 1.60'],
      correct_answer: 'C',
      explanation: 'Concrete dry-to-wet volume factor is 1.54 to account for shrinkage and voids.',
      difficulty: 'easy',
      topic: 'Concrete Works'
    },
    {
      question: 'Which document governs the standard method of measurement for building works in Nigeria?',
      options: ['A. SMM7', 'B. NRM2', 'C. CESMM4', 'D. POMI'],
      correct_answer: 'A',
      explanation: 'SMM7 (Standard Method of Measurement 7th Edition) is used for building works in Nigeria.',
      difficulty: 'easy',
      topic: 'Measurement Standards'
    },
    {
      question: 'What is the standard weight of a cement bag in Nigeria?',
      options: ['A. 25kg', 'B. 42.5kg', 'C. 50kg', 'D. 60kg'],
      correct_answer: 'C',
      explanation: 'The standard cement bag weight in Nigeria is 50kg.',
      difficulty: 'easy',
      topic: 'Construction Materials'
    },
    {
      question: 'NRM2 primarily deals with which type of works?',
      options: ['A. Building works', 'B. Civil engineering works', 'C. Interior decoration', 'D. Landscape works'],
      correct_answer: 'B',
      explanation: 'NRM2 (New Rules of Measurement 2) is for detailed measurement for civil engineering works.',
      difficulty: 'medium',
      topic: 'Measurement Standards'
    },
    {
      question: 'What is the coverage rate for emulsion paint per litre?',
      options: ['A. 5m²/litre', 'B. 8m²/litre', 'C. 10m²/litre', 'D. 15m²/litre'],
      correct_answer: 'C',
      explanation: 'Standard emulsion paint coverage is 10m² per litre for two coats.',
      difficulty: 'medium',
      topic: 'Finishing Works'
    },
    {
      question: 'In a BOQ, what does the term "provisional sum" refer to?',
      options: [
        'A. A fixed price for all work',
        'B. An estimated amount for work not yet defined',
        'C. The final cost of materials',
        'D. A penalty clause'
      ],
      correct_answer: 'B',
      explanation: 'A provisional sum is an estimated amount included in a BOQ for work whose scope is not yet fully defined.',
      difficulty: 'medium',
      topic: 'BOQ & Contracts'
    }
  ];

  // Prioritize questions in weakness areas
  if (weaknesses.length > 0) {
    const weaknessTopics = weaknesses.map(w => w.toLowerCase());
    allQuestions.sort((a, b) => {
      const aMatch = weaknessTopics.some(w => a.topic.toLowerCase().includes(w)) ? -1 : 0;
      const bMatch = weaknessTopics.some(w => b.topic.toLowerCase().includes(w)) ? -1 : 0;
      return aMatch - bMatch;
    });
  }

  return allQuestions.slice(0, 7);
}
