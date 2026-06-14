const axios = require('axios');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const paymentSettingsController = require('./paymentSettingsController');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

const EXAM_PREP_WEEKLY_AMOUNT = 200000; // ₦2,000 in kobo
const EXAM_PREP_MONTHLY_AMOUNT = 760000; // ₦7,600 in kobo (5% discount)
const EXAM_PREP_ANNUAL_AMOUNT = 9360000; // ₦93,600 in kobo (10% discount)

const EXAM_PREP_BILLING_AMOUNTS = {
  weekly: EXAM_PREP_WEEKLY_AMOUNT,
  monthly: EXAM_PREP_MONTHLY_AMOUNT,
  annual: EXAM_PREP_ANNUAL_AMOUNT,
};

const EXAM_PREP_BILLING_NGN = {
  weekly: 2000,
  monthly: 7600,
  annual: 93600,
};

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
      .eq('user_id', req.user.id);

    return res.json(success('Exam prep status', {
      active: hasAccess,
      subscription: sub || null,
      trials_used: (trials || []).length,
      trials: trials || []
    }));
  } catch (err) { next(err); }
};

// ─── Subscribe (Paystack or Bank Transfer) ────────────────────

exports.subscribe = async (req, res, next) => {
  try {
    const { email, payment_method, billing_cycle = 'weekly' } = req.body;
    const cycleAmount = EXAM_PREP_BILLING_AMOUNTS[billing_cycle] || EXAM_PREP_WEEKLY_AMOUNT;
    const cycleAmountNgn = EXAM_PREP_BILLING_NGN[billing_cycle] || 2000;

    const hasAccess = await checkExamPrepAccess(req.user.id);
    if (hasAccess) {
      return res.status(409).json(error('You already have an active exam prep subscription'));
    }

    // Bank transfer path
    if (payment_method === 'bank_transfer') {
      const { referenceNote } = req.body;

      const { data: submission, error: insertErr } = await supabase
        .from('direct_payment_submissions')
        .insert({
          user_id: req.user.id,
          plan_name: 'exam_prep_weekly',
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
          product_type: 'exam_prep_subscription',
          billing_cycle,
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: `QS Exam Prep ${billing_cycle}` }
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
      amount: cycleAmountNgn,
      billing_cycle
    }));
  } catch (err) { next(err); }
};

// ─── Bank Transfer Settings ───────────────────────────────────

exports.getBankTransferSettings = paymentSettingsController.getBankTransferSettings;

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

    // Fetch questions — match by exam_id first, fallback to metadata
    let { data: questions, error: err } = await supabase
      .from('exam_questions')
      .select('id, question_text, options, difficulty, topic, marks')
      .eq('exam_id', id);

    // If no questions linked by exam_id, match by metadata (university, course, year)
    if (!questions || questions.length === 0) {
      // Get university name and course code from the exam definition
      let uniName = null;
      let courseCode = null;

      if (exam.university_id) {
        const { data: uni } = await supabase
          .from('exam_universities')
          .select('name')
          .eq('id', exam.university_id)
          .maybeSingle();
        uniName = uni?.name;
      }

      if (exam.course_id) {
        const { data: course } = await supabase
          .from('exam_courses')
          .select('code')
          .eq('id', exam.course_id)
          .maybeSingle();
        courseCode = course?.code;
      }

      let metaQuery = supabase
        .from('exam_questions')
        .select('id, question_text, options, difficulty, topic, marks')
        .eq('is_active', true);

      if (uniName) {
        // Fuzzy match: strip commas, case-insensitive
        metaQuery = metaQuery.or(`university.ilike.%${uniName.replace(/,/g, '')}%,university.ilike.%${uniName}%`);
      }
      if (courseCode) {
        metaQuery = metaQuery.eq('course_code', courseCode);
      }
      if (exam.year) {
        metaQuery = metaQuery.eq('year', exam.year);
      }

      const metaResult = await metaQuery;
      questions = metaResult.data;
      err = metaResult.error;
    }

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
        used_at: new Date().toISOString()
      });
    } else if (!hasAccess && hasTrial) {
      return res.status(403).json(error('Subscription required. Free trial already used.', { code: 'SUBSCRIPTION_REQUIRED' }));
    }

    // Create attempt record — include all NOT NULL columns from exam_definitions
    const { data: attempt, error: insertErr } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: req.user.id,
        exam_id: id,
        exam_category: exam.category || 'university',
        exam_name: exam.exam_name || 'Exam',
        total_questions: exam.total_questions || 0,
        time_limit_seconds: (exam.time_limit_minutes || 60) * 60,
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

    // Get exam definition for passing_score
    const { data: examDef } = await supabase
      .from('exam_definitions')
      .select('passing_score')
      .eq('id', id)
      .single();

    const passingScore = examDef?.passing_score || 50;

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
    const passed = percentage >= passingScore;

    // Calculate time spent
    const startTime = new Date(attempt.started_at);
    const endTime = new Date();
    const timeSpentSeconds = Math.round((endTime - startTime) / 1000);

    // Update attempt — write to both score and percentage for backward compatibility
    const { error: updateErr } = await supabase
      .from('exam_attempts')
      .update({
        answers,
        earned_marks: earnedMarks,
        total_marks: totalMarks,
        score: percentage,
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
      score: percentage,
      percentage,
      earned_marks: earnedMarks,
      total_marks: totalMarks,
      correct_count: correctCount,
      total_questions: answers.length,
      time_spent_seconds: timeSpentSeconds,
      passed,
      passing_score: passingScore,
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
      .select('id, exam_id, score, percentage, earned_marks, total_marks, correct_count, total_questions, is_trial, status, started_at, submitted_at, exam:exam_definitions(exam_name, category)', { count: 'exact' })
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
    const { search } = req.query;

    let query = supabase
      .from('exam_universities')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: universities, error: err } = await query;

    if (err) throw err;

    // Count courses per university
    const uniIds = (universities || []).map(u => u.id);
    let courseCounts = {};
    if (uniIds.length > 0) {
      const { data: courses } = await supabase
        .from('exam_courses')
        .select('university_id')
        .eq('is_active', true)
        .in('university_id', uniIds);

      (courses || []).forEach(c => {
        courseCounts[c.university_id] = (courseCounts[c.university_id] || 0) + 1;
      });
    }

    const enriched = (universities || []).map(u => ({
      ...u,
      course_count: courseCounts[u.id] || 0
    }));

    return res.json(success('Universities', { universities: enriched }));
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

    // Count questions per course by matching course_code
    // Use fuzzy university name matching (strip commas, case-insensitive)
    const courseCodes = (courses || []).map(c => c.code).filter(Boolean);
    let questionCounts = {};
    if (courseCodes.length > 0) {
      const { data: questions } = await supabase
        .from('exam_questions')
        .select('course_code, university')
        .eq('is_active', true)
        .in('course_code', courseCodes);

      const normalizedName = university.name.toLowerCase().replace(/,/g, '').trim();

      (questions || []).forEach(q => {
        const qUni = (q.university || '').toLowerCase().replace(/,/g, '').trim();
        // Match if normalized names are equal, or one contains the other
        if (qUni === normalizedName || normalizedName.includes(qUni) || qUni.includes(normalizedName)) {
          const code = q.course_code;
          if (code) questionCounts[code] = (questionCounts[code] || 0) + 1;
        }
      });
    }

    const enriched = (courses || []).map(c => ({
      ...c,
      question_count: questionCounts[c.code] || 0
    }));

    return res.json(success('University courses', { university, courses: enriched }));
  } catch (err) { next(err); }
};

// ─── Past Questions ────────────────────────────────────────────

exports.getPastQuestions = async (req, res, next) => {
  try {
    const { university, course, year, category, search, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('exam_definitions')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .eq('is_past_question', true);

    if (university) query = query.eq('university_id', university);
    if (course) query = query.eq('course_id', course);
    if (year) query = query.eq('year', parseInt(year));
    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('exam_name', `%${search}%`);

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

// ─── Global Search ────────────────────────────────────────────

exports.globalSearch = async (req, res, next) => {
  try {
    const { q, type = 'all' } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json(success('Search results', { universities: [], courses: [], exams: [] }));
    }

    const searchTerm = q.trim();
    const results = { universities: [], courses: [], exams: [] };

    // Search universities
    if (type === 'all' || type === 'universities') {
      const { data } = await supabase
        .from('exam_universities')
        .select('id, name, short_name, logo_url')
        .eq('is_active', true)
        .ilike('name', `%${searchTerm}%`)
        .limit(10);
      results.universities = data || [];
    }

    // Search courses
    if (type === 'all' || type === 'courses') {
      const { data } = await supabase
        .from('exam_courses')
        .select('id, name, code, university_id, university:exam_universities(name)')
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
        .limit(10);
      results.courses = data || [];
    }

    // Search exams/past questions
    if (type === 'all' || type === 'exams') {
      const { data } = await supabase
        .from('exam_definitions')
        .select('id, exam_name, category, year, university_id, course_id')
        .eq('is_published', true)
        .ilike('exam_name', `%${searchTerm}%`)
        .limit(10);
      results.exams = data || [];
    }

    return res.json(success('Search results', results));
  } catch (err) { next(err); }
};

// ─── Search Analytics ─────────────────────────────────────────

exports.logSearch = async (req, res, next) => {
  try {
    const { query: searchQuery, type, results_count } = req.body;

    await supabase.from('exam_search_logs').insert({
      user_id: req.user.id,
      query: searchQuery,
      search_type: type || 'all',
      results_count: results_count || 0,
      searched_at: new Date().toISOString()
    });

    return res.json(success('Search logged'));
  } catch (err) { next(err); }
};
