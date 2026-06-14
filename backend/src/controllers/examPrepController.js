const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

const EXAM_PREP_WEEKLY_AMOUNT = 200000; // ₦2,000 in kobo

// ─── Helpers ───────────────────────────────────────────────────

async function checkExamPrepAccess(userId) {
  const { data } = await supabase
    .from('exam_prep_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();
  return !!data;
}

async function checkFreeTrialUsed(userId, examId) {
  const { data } = await supabase
    .from('exam_trials')
    .select('id')
    .eq('user_id', userId)
    .eq('exam_id', examId)
    .eq('is_trial', true)
    .maybeSingle();
  return !!data;
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
    const hasAccess = await checkExamPrepAccess(req.user.id);

    const { data: sub } = await supabase
      .from('exam_prep_subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check trial usage
    const { data: trials } = await supabase
      .from('exam_trials')
      .select('id, exam_id, used_at')
      .eq('user_id', req.user.id)
      .eq('is_trial', true);

    return res.json(success('Exam prep status', {
      active: hasAccess,
      subscription: sub || null,
      trials_used: (trials || []).length,
      trials: trials || []
    }));
  } catch (err) { next(err); }
};

// ─── Subscribe (Paystack) ─────────────────────────────────────

exports.subscribe = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json(error('Email is required'));

    const hasAccess = await checkExamPrepAccess(req.user.id);
    if (hasAccess) {
      return res.status(409).json(error('You already have an active exam prep subscription'));
    }

    let paystackRes;
    try {
      paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
        email,
        amount: EXAM_PREP_WEEKLY_AMOUNT,
        currency: 'NGN',
        metadata: {
          user_id: req.user.id,
          product_type: 'exam_prep_subscription',
          billing_cycle: 'weekly',
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: 'QS Exam Prep Weekly' }
          ]
        },
        callback_url: `${process.env.FRONTEND_URL}/exam-prep`
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

// ─── Exams ─────────────────────────────────────────────────────

exports.getExams = async (req, res, next) => {
  try {
    const { category, exam_name, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('exam_definitions')
      .select('*', { count: 'exact' })
      .eq('is_published', true);

    if (category) query = query.eq('category', category);
    if (exam_name) query = query.ilike('exam_name', `%${exam_name}%`);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1).order('created_at', { ascending: false });

    const { data: exams, count, error: err } = await query;
    if (err) throw err;

    return res.json(success('Exams', {
      exams: exams || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (err) { next(err); }
};

exports.getExamQuestions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question_count } = req.query;

    const { data: exam } = await supabase
      .from('exam_definitions')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (!exam) return res.status(404).json(error('Exam not found'));

    // Check access or trial
    const hasAccess = await checkExamPrepAccess(req.user.id);
    const hasTrial = await checkFreeTrialUsed(req.user.id, id);

    if (!hasAccess && hasTrial) {
      return res.status(403).json(error('Subscription required. Free trial already used for this exam.', { code: 'SUBSCRIPTION_REQUIRED' }));
    }

    // Fetch questions
    let questionQuery = supabase
      .from('exam_questions')
      .select('id, question, options, difficulty, topic, marks')
      .eq('exam_id', id);

    const { data: questions, error: err } = await questionQuery;
    if (err) throw err;

    if (!questions || questions.length === 0) {
      return res.status(404).json(error('No questions found for this exam'));
    }

    // Randomize order
    let selectedQuestions = shuffleArray(questions);

    // Apply limit
    const count = question_count ? parseInt(question_count) : questions.length;
    selectedQuestions = selectedQuestions.slice(0, Math.min(count, selectedQuestions.length));

    // Shuffle options for each MCQ
    const safeQuestions = selectedQuestions.map(q => ({
      ...q,
      options: shuffleArray(q.options || [])
    }));

    return res.json(success('Exam questions', {
      exam_id: id,
      exam_name: exam.exam_name,
      questions: safeQuestions,
      total_questions: safeQuestions.length,
      time_limit_minutes: exam.time_limit_minutes || 60
    }));
  } catch (err) { next(err); }
};

exports.startExam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: exam } = await supabase
      .from('exam_definitions')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (!exam) return res.status(404).json(error('Exam not found'));

    // Check access or trial eligibility
    const hasAccess = await checkExamPrepAccess(req.user.id);
    const hasTrial = await checkFreeTrialUsed(req.user.id, id);

    let isTrial = false;
    if (!hasAccess && !hasTrial) {
      isTrial = true;
      // Record trial usage
      await supabase.from('exam_trials').insert({
        user_id: req.user.id,
        exam_id: id,
        is_trial: true,
        used_at: new Date().toISOString()
      });
    } else if (!hasAccess && hasTrial) {
      return res.status(403).json(error('Subscription required. Free trial already used.', { code: 'SUBSCRIPTION_REQUIRED' }));
    }

    // Create attempt record
    const { data: attempt, error: insertErr } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: req.user.id,
        exam_id: id,
        is_trial: isTrial,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.json(success('Exam attempt started', {
      attempt_id: attempt.id,
      exam_name: exam.exam_name,
      is_trial: isTrial,
      time_limit_minutes: exam.time_limit_minutes || 60,
      started_at: attempt.started_at
    }));
  } catch (err) { next(err); }
};

exports.submitExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers, attempt_id } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json(error('answers array is required'));
    }

    // Find attempt
    let attemptQuery = supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', id)
      .eq('user_id', req.user.id)
      .eq('status', 'in_progress');

    if (attempt_id) {
      attemptQuery = attemptQuery.eq('id', attempt_id);
    }

    const { data: attempt } = await attemptQuery
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (!attempt) {
      return res.status(404).json(error('No in-progress attempt found for this exam'));
    }

    // Get questions
    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, correct_answer, explanation, difficulty, topic, marks')
      .eq('exam_id', id);

    if (!questions || questions.length === 0) {
      return res.status(400).json(error('No questions found for this exam'));
    }

    // Build lookup map
    const questionMap = {};
    questions.forEach(q => { questionMap[q.id] = q; });

    // Score
    let totalMarks = 0;
    let earnedMarks = 0;
    let correctCount = 0;
    const detailedResults = [];

    for (const ans of answers) {
      const q = questionMap[ans.question_id];
      if (!q) continue;

      const questionMarks = q.marks || 1;
      totalMarks += questionMarks;

      const userAnswer = (ans.answer || '').toUpperCase().trim();
      const correctAnswer = (q.correct_answer || '').toUpperCase().trim();
      const isCorrect = userAnswer === correctAnswer;

      if (isCorrect) {
        earnedMarks += questionMarks;
        correctCount++;
      }

      detailedResults.push({
        question_id: ans.question_id,
        user_answer: ans.answer || '',
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        marks_earned: isCorrect ? questionMarks : 0,
        marks_possible: questionMarks,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topic: q.topic
      });
    }

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;

    // Calculate time spent
    const startTime = new Date(attempt.started_at);
    const endTime = new Date();
    const timeSpentSeconds = Math.round((endTime - startTime) / 1000);

    // Update attempt
    const { error: updateErr } = await supabase
      .from('exam_attempts')
      .update({
        answers,
        earned_marks: earnedMarks,
        total_marks: totalMarks,
        percentage,
        correct_count: correctCount,
        total_questions: answers.length,
        time_spent_seconds: timeSpentSeconds,
        status: 'completed',
        submitted_at: endTime.toISOString(),
        detailed_results: detailedResults
      })
      .eq('id', attempt.id);

    if (updateErr) throw updateErr;

    return res.json(success('Exam submitted', {
      attempt_id: attempt.id,
      percentage,
      earned_marks: earnedMarks,
      total_marks: totalMarks,
      correct_count: correctCount,
      total_questions: answers.length,
      time_spent_seconds: timeSpentSeconds,
      is_trial: attempt.is_trial,
      detailed_results: detailedResults
    }));
  } catch (err) { next(err); }
};

// ─── Attempts ──────────────────────────────────────────────────

exports.getAttempts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('exam_attempts')
      .select('id, exam_id, percentage, earned_marks, total_marks, correct_count, total_questions, is_trial, status, started_at, submitted_at, exam:exam_definitions(exam_name, category)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .neq('status', 'in_progress');

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1).order('submitted_at', { ascending: false });

    const { data: attempts, count, error: err } = await query;
    if (err) throw err;

    return res.json(success('Exam attempts', {
      attempts: attempts || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (err) { next(err); }
};

exports.getAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: attempt, error: err } = await supabase
      .from('exam_attempts')
      .select('*, exam:exam_definitions(exam_name, category, time_limit_minutes)')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (err || !attempt) return res.status(404).json(error('Attempt not found'));

    return res.json(success('Attempt detail', { attempt }));
  } catch (err) { next(err); }
};

// ─── Universities ──────────────────────────────────────────────

exports.getUniversities = async (req, res, next) => {
  try {
    const { data: universities, error: err } = await supabase
      .from('exam_universities')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (err) throw err;
    return res.json(success('Universities', { universities: universities || [] }));
  } catch (err) { next(err); }
};

exports.getUniversityCourses = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: university } = await supabase
      .from('exam_universities')
      .select('id, name')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (!university) return res.status(404).json(error('University not found'));

    const { data: courses, error: err } = await supabase
      .from('exam_courses')
      .select('*')
      .eq('university_id', id)
      .eq('is_active', true)
      .order('name');

    if (err) throw err;

    return res.json(success('University courses', { university, courses: courses || [] }));
  } catch (err) { next(err); }
};

// ─── Past Questions ────────────────────────────────────────────

exports.getPastQuestions = async (req, res, next) => {
  try {
    const { university, course, year, category, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('exam_definitions')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .eq('is_past_question', true);

    if (university) query = query.eq('university_id', university);
    if (course) query = query.eq('course_id', course);
    if (year) query = query.eq('year', parseInt(year));
    if (category) query = query.eq('category', category);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1).order('year', { ascending: false });

    const { data: pastQuestions, count, error: err } = await query;
    if (err) throw err;

    return res.json(success('Past questions', {
      past_questions: pastQuestions || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (err) { next(err); }
};
