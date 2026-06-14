const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

const ACADEMY_WEEKLY_AMOUNT = 200000; // ₦2,000 in kobo

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

async function getUserProfile(userId) {
  const { data } = await supabase
    .from('users')
    .select('email, name, org_role')
    .eq('id', userId)
    .single();
  return data;
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

    return res.json(success('Academy status', {
      active: hasAccess,
      subscription: sub || null
    }));
  } catch (err) { next(err); }
};

// ─── Subscribe (Paystack) ─────────────────────────────────────

exports.subscribe = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json(error('Email is required'));

    // Check if already has active subscription
    const hasAccess = await checkAcademyAccess(req.user.id);
    if (hasAccess) {
      return res.status(409).json(error('You already have an active academy subscription'));
    }

    // Initialize Paystack transaction
    let paystackRes;
    try {
      paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
        email,
        amount: ACADEMY_WEEKLY_AMOUNT,
        currency: 'NGN',
        metadata: {
          user_id: req.user.id,
          product_type: 'academy_subscription',
          billing_cycle: 'weekly',
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: 'QS Academy Weekly' }
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
      amount: 2000,
      billing_cycle: 'weekly'
    }));
  } catch (err) { next(err); }
};

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

    // Check for in-progress test
    const { data: inProgress } = await supabase
      .from('academy_admission_tests')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (inProgress) {
      return res.status(409).json(error('You already have an in-progress admission test'));
    }

    // Get user's profile for personalized questions
    const { data: profile } = await supabase
      .from('academy_profiles')
      .select('strengths, weaknesses')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const strengths = profile?.strengths || [];
    const weaknesses = profile?.weaknesses || [];

    // Use AI to generate 7 QS-domain questions
    const prompt = `Generate 7 multiple-choice questions for a Quantity Surveying admission test.
The student's strengths: ${strengths.length ? strengths.join(', ') : 'Not yet assessed'}
The student's weaknesses: ${weaknesses.length ? weaknesses.join(', ') : 'Not yet assessed'}

Focus on areas where the student needs improvement, but include some questions in their strength areas.

Topics should cover: Nigerian QS standards, SMM7, NRM2, building measurement, cost estimation, construction materials, contracts and procurement.

Output valid JSON array with this exact structure:
[
  {
    "question": "question text?",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct_answer": "A",
    "explanation": "brief explanation of correct answer",
    "difficulty": "easy|medium|hard",
    "topic": "topic area"
  }
]

Return exactly 7 questions. Do not include any text outside the JSON array.`;

    // Try AI generation, fall back to curated questions
    let questions;
    try {
      const aiService = require('../services/aiService');
      const raw = await aiService.generateContent(prompt, { temperature: 0.5 });
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 7) {
          questions = parsed;
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

    // Score the test
    const questions = test.questions || [];
    let correctCount = 0;
    const results = questions.map((q, idx) => {
      const userAnswer = answers[idx]?.answer || '';
      const isCorrect = userAnswer.toUpperCase() === q.correct_answer.toUpperCase();
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        user_answer: userAnswer,
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
        submitted_at: new Date().toISOString()
      })
      .eq('id', test.id);

    if (updateErr) throw updateErr;

    return res.json(success(passed ? 'Congratulations! You passed the admission test.' : 'Admission test completed. You did not meet the pass mark.', {
      test_id: test.id,
      score,
      passed,
      correct_count: correctCount,
      total_questions: questions.length,
      pass_mark: 60,
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
    return res.json(success('Pathways', { pathways: pathways || [] }));
  } catch (err) { next(err); }
};

exports.getPathwayDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const { data: pathway, error: err } = await supabase
      .from('academy_pathways')
      .select('*, academy_pathway_modules(*)')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (err || !pathway) return res.status(404).json(error('Pathway not found'));

    // Check enrollment
    const { data: enrollment } = await supabase
      .from('academy_enrollments')
      .select('id, enrolled_at')
      .eq('user_id', req.user.id)
      .eq('pathway_id', pathway.id)
      .maybeSingle();

    return res.json(success('Pathway detail', {
      pathway,
      enrolled: !!enrollment,
      enrolled_at: enrollment?.enrolled_at || null
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
      .select('id, enrolled_at, pathway:academy_pathways(id, title, slug, module_count)')
      .eq('user_id', req.user.id)
      .order('enrolled_at', { ascending: false });

    if (err) throw err;

    // Get progress for each enrollment
    const progressData = await Promise.all((enrollments || []).map(async (enrollment) => {
      const { data: progress } = await supabase
        .from('academy_module_progress')
        .select('module_id, completed')
        .eq('user_id', req.user.id)
        .eq('pathway_id', enrollment.pathway?.id);

      const completedCount = (progress || []).filter(p => p.completed).length;
      const totalModules = enrollment.pathway?.module_count || 0;

      return {
        enrollment_id: enrollment.id,
        pathway: enrollment.pathway,
        enrolled_at: enrollment.enrolled_at,
        completed_modules: completedCount,
        total_modules: totalModules,
        progress_percent: totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0
      };
    }));

    return res.json(success('Pathway progress', { progress: progressData }));
  } catch (err) { next(err); }
};

// ─── Resources ─────────────────────────────────────────────────

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
    const { title, description, scheduled_at, duration_minutes = 30, max_participants } = req.body;

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

    const { data: contest, error: insertErr } = await supabase
      .from('academy_contests')
      .insert({
        creator_id: req.user.id,
        title,
        description: description || '',
        scheduled_at: scheduled_at || null,
        duration_minutes,
        max_participants: max_participants || null,
        status: scheduled_at ? 'scheduled' : 'draft',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.status(201).json(success('Contest created', { contest }));
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
      const userAnswer = (answers[i]?.answer || '').toUpperCase();
      const isCorrect = userAnswer === q.correct_answer.toUpperCase();

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
      source_type: 'contest',
      source_id: id,
      description: `Contest: ${contest.title} - ${totalPoints} points`,
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
      .select('amount, source_type, description, created_at')
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
      .select('id, enrolled_at, pathway:academy_pathways(title)')
      .eq('user_id', req.user.id);

    // Module progress
    const { data: moduleProgress } = await supabase
      .from('academy_module_progress')
      .select('module_id, completed, completed_at')
      .eq('user_id', req.user.id);

    // Contest stats
    const { data: contestSubmissions } = await supabase
      .from('academy_contest_submissions')
      .select('total_points, submitted_at')
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
      .select('amount')
      .eq('user_id', req.user.id);

    const totalTokens = (tokens || []).reduce((sum, t) => sum + (t.amount || 0), 0);

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
      contests_participated: (contestSubmissions || []).length,
      total_contest_points: (contestSubmissions || []).reduce((s, c) => s + (c.total_points || 0), 0),
      admission_test: admissionTest || null,
      total_tokens: totalTokens,
      study_streak_days: streak
    }));
  } catch (err) { next(err); }
};

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
