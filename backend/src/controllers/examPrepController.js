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

const EXAM_PREP_WEEKLY_AMOUNT = 200000; // ₦2,000 in kobo
const EXAM_PREP_MONTHLY_AMOUNT = 760000; // ₦7,600 in kobo (5% discount)
const EXAM_PREP_ANNUAL_AMOUNT = 9360000; // ₦93,600 in kobo (10% discount)

const EXAM_PREP_BILLING_AMOUNTS = {
  weekly: EXAM_PREP_WEEKLY_AMOUNT,
  monthly: EXAM_PREP_MONTHLY_AMOUNT,
  annual: EXAM_PREP_ANNUAL_AMOUNT,
};

function extractAnswerLetter(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s) return '';
  if (/^[A-F]$/i.test(s)) return s.toUpperCase();
  const match = s.match(/^\(?\[?\s*([A-F])\s*\)?\]?[.:\s)/]/i) || s.match(/option\s+([A-F])/i);
  if (match) return match[1].toUpperCase();
  const first = s.charAt(0).toUpperCase();
  return /^[A-F]$/.test(first) ? first : '';
}

function stripJsonFences(raw) {
  if (!raw) return '';
  let s = raw.trim();
  // Remove markdown code fences: ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return s.trim();
}

// Shared question lookup with fallback strategies (used by getExamQuestions and submitExam)
async function findExamQuestions(exam, fields = 'id, question_text, options, difficulty, topic, marks') {
  // Resolve university name and course code
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

  // Determine lookup strategy based on exam type
  const isStudentExam = !!(uniName || courseCode);
  const isProfessionalExam = !isStudentExam && !!(exam.exam_name);

  if (isStudentExam) {
    // Strategy 1: university + course_code + year (exact match)
    let q = supabase.from('exam_questions').select(fields);
    if (uniName) q = q.ilike('university', `%${uniName.replace(/,/g, '')}%`);
    if (courseCode) q = q.ilike('course_code', `%${courseCode}%`);
    if (exam.year) q = q.eq('year', exam.year);
    const { data } = await q;
    if (data && data.length > 0) return data;

    // Strategy 2: exam_name ILIKE (exam def name matches question exam_name)
    if (exam.exam_name) {
      let q1b = supabase.from('exam_questions').select(fields);
      q1b = q1b.ilike('exam_name', `%${exam.exam_name.replace(/\s*—\s*\d{4}$/, '').trim()}%`);
      const { data: d1b } = await q1b;
      if (d1b && d1b.length > 0) return d1b;
    }

    // Strategy 3: university + year (without course_code — course_code may mismatch)
    if (uniName && exam.year) {
      let q2 = supabase.from('exam_questions').select(fields);
      q2 = q2.ilike('university', `%${uniName.replace(/,/g, '')}%`);
      q2 = q2.eq('year', exam.year);
      const { data: d2 } = await q2;
      if (d2 && d2.length > 0) return d2;
    }

    // Strategy 4: university + course_code (no year)
    if (uniName && courseCode) {
      let q3 = supabase.from('exam_questions').select(fields);
      q3 = q3.ilike('university', `%${uniName.replace(/,/g, '')}%`);
      q3 = q3.ilike('course_code', `%${courseCode}%`);
      const { data: d3 } = await q3;
      if (d3 && d3.length > 0) return d3;
    }

    // Strategy 5: university only + year
    if (uniName) {
      let q4 = supabase.from('exam_questions').select(fields);
      q4 = q4.ilike('university', `%${uniName.replace(/,/g, '')}%`);
      if (exam.year) q4 = q4.eq('year', exam.year);
      const { data: d4 } = await q4;
      if (d4 && d4.length > 0) return d4;
    }

    // Strategy 6: university only (any year)
    if (uniName) {
      let q5 = supabase.from('exam_questions').select(fields);
      q5 = q5.ilike('university', `%${uniName.replace(/,/g, '')}%`);
      const { data: d5 } = await q5;
      if (d5 && d5.length > 0) return d5;
    }

    return [];
  }

  if (isProfessionalExam) {
    // Professional exams: merge exam_id matches (explicit FK) with exam_name matches (seed data)
    const [{ data: byExamId }, { data: byExamName }] = await Promise.all([
      supabase.from('exam_questions').select(fields).eq('exam_id', exam.id),
      supabase.from('exam_questions').select(fields)
        .ilike('exam_name', `%${exam.exam_name}%`)
        .eq('exam_category', exam.category)
    ]);

    const idQuestions = byExamId || [];
    const nameQuestions = byExamName || [];

    if (idQuestions.length === 0 && nameQuestions.length === 0) return [];

    // Merge: start with exam_id results, add unique exam_name results
    const seenTexts = new Set(idQuestions.map(q => q.question_text));
    const merged = [...idQuestions];
    for (const q of nameQuestions) {
      if (!seenTexts.has(q.question_text)) {
        merged.push(q);
        seenTexts.add(q.question_text);
      }
    }
    return merged;
  }

  return [];
}

const EXAM_PREP_BILLING_NGN = {
  weekly: 2000,
  monthly: 7600,
  annual: 93600,
};

// ─── Helpers ───────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findExamByIdOrSlug(id) {
  const isUuid = UUID_RE.test(id);
  if (isUuid) {
    const { data } = await supabase
      .from('exam_definitions')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single();
    return data;
  }
  const { data } = await supabase
    .from('exam_definitions')
    .select('*')
    .eq('slug', id)
    .eq('is_published', true)
    .single();
  return data;
}

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

// ─── AI Question Generation ────────────────────────────────────

async function generateExamQuestions(exam, count, existingTexts = []) {
  const { callAI } = require('../services/aiService');

  const examContext = exam.category === 'nigerian_professional'
    ? `Professional Nigerian QS exam: ${exam.exam_name}. Covers measurement standards (SMM7, NRM2), BOQ preparation, construction law, and professional practice.`
    : `University past question exam: ${exam.exam_name} (${exam.year || ''}). University: ${exam.university_id || 'Nigerian university'}. Course: ${exam.course_id || 'QS course'}.`;

  const avoidSection = existingTexts.length > 0
    ? `\nAVOID THESE EXISTING QUESTIONS (do NOT generate similar or identical):\n${existingTexts.slice(0, 50).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
    : '';

  // Determine mix based on exam format
  const format = (exam.format || '').toLowerCase();
  let mcqCount = count;
  let otherCount = 0;
  let typeInstructions = '';

  if (format.includes('short answer') || format.includes('long question')) {
    // Mix MCQs with text-based questions
    mcqCount = Math.round(count * 0.6);
    otherCount = count - mcqCount;
    typeInstructions = `
MIX OF QUESTION TYPES: ${mcqCount} MCQs + ${otherCount} text-based questions.
For text-based questions, use question_type "short_answer" or "long_answer" with "correct_answer" being a brief model answer.
Include "sample_answer" for text-based questions.`;
  } else if (format.includes('mock interview')) {
    mcqCount = Math.round(count * 0.3);
    otherCount = count - mcqCount;
    typeInstructions = `
MIX OF QUESTION TYPES: ${mcqCount} MCQs + ${otherCount} mock interview questions.
For mock interview questions, use question_type "mock_interview" with scenario-based prompts.
Include "scoring_rubric" explaining how to evaluate the response.`;
  } else {
    typeInstructions = `
Generate all questions as MCQs with 4 options (A, B, C, D).`;
  }

  const prompt = `You are Dr. Q, an expert Nigerian Quantity Surveying examiner creating exam questions.

EXAM CONTEXT: ${examContext}
NUMBER OF QUESTIONS: ${count}
${avoidSection}
INSTRUCTIONS:
1. Generate exactly ${count} UNIQUE, accurate questions.
2. Questions must be factually correct and exam-appropriate.
3. Use Nigerian QS context: Naira amounts, local materials, Nigerian standards (SMM7, NRM2, NESI).
4. Mix difficulty: ~40% easy, ~40% medium, ~20% hard.
5. IMPORTANT: Do NOT prefix questions with numbers like "1." or "Q1."
6. IMPORTANT: The question_text must contain ONLY the question text, no option letters.
7. IMPORTANT: Every question must be distinctly different in topic, wording, and concept.
8. VARY topics across: measurement, BOQ, contracts, valuation, cost planning, construction law, professional practice, project management, materials, and site practice.
${typeInstructions}

OUTPUT: Valid JSON array with exactly ${count} objects.

For MCQ questions:
{
  "question_text": "clear question text WITHOUT numbering",
  "question_type": "mcq",
  "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
  "correct_answer": "B",
  "explanation": "brief explanation",
  "difficulty": "easy|medium|hard",
  "topic": "topic category"
}

For text-based questions:
{
  "question_text": "clear question text WITHOUT numbering",
  "question_type": "short_answer|long_answer|mock_interview",
  "correct_answer": "model answer text",
  "sample_answer": "detailed model answer",
  "scoring_rubric": "how to score this answer",
  "explanation": "brief explanation",
  "difficulty": "easy|medium|hard",
  "topic": "topic category",
  "max_words": 200
}

The correct_answer for MCQ must be a SINGLE LETTER (A, B, C, or D).
Return ONLY the JSON array. No markdown, no text outside the array.`;

  const raw = await callAI(prompt, { temperature: 0.8 });
  if (!raw) throw new Error('No AI response');

  let parsed;
  try {
    const cleaned = stripJsonFences(raw);
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Invalid AI response format');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI returned empty or invalid array');
  }

  // Dedup: remove duplicates within the AI response itself
  const seenTexts = new Set(existingTexts.map(t => t.toLowerCase().trim()));
  const unique = [];
  for (const q of parsed) {
    const text = (q.question_text || q.question || '').replace(/^\d+\.\s*/, '').trim();
    const key = text.toLowerCase();
    if (!seenTexts.has(key) && text.length > 10) {
      seenTexts.add(key);
      const qType = q.question_type || 'mcq';
      unique.push({
        question_text: text,
        question_type: qType,
        options: q.options || [],
        correct_answer: qType === 'mcq' ? extractAnswerLetter(q.correct_answer) : (q.correct_answer || ''),
        sample_answer: q.sample_answer || null,
        scoring_rubric: q.scoring_rubric || null,
        max_words: q.max_words || null,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        topic: q.topic || exam.exam_name || 'General'
      });
    }
  }

  return unique.slice(0, count);
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
      subscription_status: sub?.status || null,
      subscription: sub || null,
      trials_used: (trials || []).length,
      trials: trials || [],
      free_trial_available: (trials || []).length === 0
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

    const exam = await findExamByIdOrSlug(id);
    if (!exam) return res.status(404).json(error('Exam not found'));

    // Check access or trial
    const hasAccess = await checkExamPrepAccess(req.user.id);
    const hasTrial = await checkFreeTrialUsed(req.user.id, exam.id);

    if (!hasAccess && hasTrial) {
      return res.status(403).json(error('Subscription required. Free trial already used for this exam.', { code: 'SUBSCRIPTION_REQUIRED' }));
    }

    // Fetch questions — match by exam_id first, fallback to metadata strategies
    const fields = 'id, question_text, options, difficulty, topic, marks';
    let questions = await findExamQuestions(exam, fields);

    const requestedCount = question_count ? parseInt(question_count) : (exam.total_questions || 50);

    // AI-generate remaining questions if seed data is insufficient
    if (!questions || questions.length < requestedCount) {
      const needed = requestedCount - (questions?.length || 0);
      if (needed > 0) {
        try {
          // Pass existing question texts to avoid repetition
          const existingTexts = (questions || []).map(q => q.question_text || '');
          const aiQuestions = await generateExamQuestions(exam, needed, existingTexts);
          if (aiQuestions && aiQuestions.length > 0) {
            // Store AI-generated questions for future use
            const insertRows = aiQuestions.map(q => ({
              exam_id: exam.id,
              exam_category: exam.category || 'university',
              exam_name: exam.exam_name || exam.title || '',
              topic: q.topic || exam.exam_name || 'General',
              question_text: q.question_text,
              question_type: q.question_type || 'mcq',
              options: q.options,
              correct_answer: q.correct_answer,
              sample_answer: q.sample_answer || null,
              scoring_rubric: q.scoring_rubric || null,
              max_words: q.max_words || null,
              explanation: q.explanation || '',
              difficulty: q.difficulty || 'medium',
              is_active: true
            }));

            const { error: insertErr } = await supabase
              .from('exam_questions')
              .insert(insertRows, { onConflict: 'exam_id,question_text', ignoreDuplicates: true });

            if (!insertErr) {
              // Re-fetch to get IDs and include in results
              const freshQuestions = await findExamQuestions(exam, fields);
              if (freshQuestions && freshQuestions.length > questions.length) {
                questions = freshQuestions;
              } else {
                // Append AI questions with temp IDs
                questions = [...(questions || []), ...aiQuestions.map((q, i) => ({
                  id: `ai-${exam.id}-${Date.now()}-${i}`,
                  ...q
                }))];
              }
            }
          }
        } catch (aiErr) {
          logger.warn('AI question generation failed for exam', { exam_id: exam.id, error: aiErr.message });
          // Fall through with whatever seed questions we have
        }
      }
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json(error('No questions available for this exam yet. Questions may be being added.', { 
        code: 'NO_QUESTIONS',
        exam_id: id,
        exam_name: exam.exam_name
      }));
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
      exam_id: exam.id,
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

    const exam = await findExamByIdOrSlug(id);
    if (!exam) return res.status(404).json(error('Exam not found'));

    // Check access or trial eligibility
    const hasAccess = await checkExamPrepAccess(req.user.id);
    const hasTrial = await checkFreeTrialUsed(req.user.id, exam.id);

    let isTrial = false;
    if (!hasAccess && !hasTrial) {
      isTrial = true;
      // Record trial usage
      await supabase.from('exam_trials').insert({
        user_id: req.user.id,
        exam_id: exam.id,
        used_at: new Date().toISOString()
      });
    } else if (!hasAccess && hasTrial) {
      return res.status(403).json(error('Subscription required. Free trial already used.', { code: 'SUBSCRIPTION_REQUIRED' }));
    }

    // Create attempt record — use resolved UUID for exam_id
    const { data: attempt, error: insertErr } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: req.user.id,
        exam_id: exam.id,
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
      exam_id: exam.id,
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

    // Resolve exam (supports UUID or slug)
    const exam = await findExamByIdOrSlug(id);
    if (!exam) return res.status(404).json(error('Exam not found'));

    // Find attempt — use resolved UUID
    let attemptQuery = supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', exam.id)
      .eq('user_id', req.user.id)
      .eq('status', 'in_progress');

    if (attempt_id) {
      attemptQuery = attemptQuery.eq('id', attempt_id);
    }

    const { data: attempt } = await attemptQuery
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attempt) {
      return res.status(404).json(error('No in-progress attempt found for this exam'));
    }

    // Get passing_score from exam definition (already resolved)
    const passingScore = exam.passing_score || 50;

    // Get questions — use shared helper with fallback strategies
    const submitFields = 'id, question_text, options, correct_answer, explanation, difficulty, topic, marks, question_type';
    const questions = await findExamQuestions(exam, submitFields);

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

    // Helper: convert various answer formats to a single letter (A-F)
    const toLetter = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val).trim();
      if (!s) return '';
      if (/^[A-F]$/i.test(s)) return s.toUpperCase();
      const idx = parseInt(s, 10);
      if (!isNaN(idx) && idx >= 0 && idx < 6) return String.fromCharCode(65 + idx);
      const match = s.match(/^\(?\[?\s*([A-F])\s*\)?\]?[.:\s)/]/i) || s.match(/option\s+([A-F])/i);
      if (match) return match[1].toUpperCase();
      const first = s.charAt(0).toUpperCase();
      return /^[A-F]$/.test(first) ? first : '';
    };

    // Helper: check if question type is MCQ-like (letter-based scoring)
    const isMcqType = (type) => ['mcq', 'true_false'].includes(type);

    // Collect text-based questions for batch AI assessment
    const textAnswers = [];
    const mcqAnswers = [];

    for (const ans of answers) {
      const q = questionMap[ans.question_id];
      if (!q) continue;
      const qType = q.question_type || 'mcq';
      const rawAnswer = ans.answer !== undefined ? ans.answer : ans.selected_option;

      if (isMcqType(qType)) {
        mcqAnswers.push({ ans, q, rawAnswer });
      } else {
        textAnswers.push({ ans, q, rawAnswer });
      }
    }

    // Score MCQ answers (instant)
    for (const { ans, q, rawAnswer } of mcqAnswers) {
      const questionMarks = q.marks || 1;
      totalMarks += questionMarks;

      const userLetter = toLetter(rawAnswer);
      const correctLetter = toLetter(q.correct_answer);
      const isCorrect = userLetter !== '' && correctLetter !== '' && userLetter === correctLetter;

      if (isCorrect) {
        earnedMarks += questionMarks;
        correctCount++;
      }

      detailedResults.push({
        question_id: ans.question_id,
        question_text: q.question_text,
        question_type: q.question_type || 'mcq',
        options: q.options,
        user_answer: rawAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        marks_earned: isCorrect ? questionMarks : 0,
        marks_possible: questionMarks,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topic: q.topic
      });
    }

    // Score text-based answers (batch AI assessment)
    if (textAnswers.length > 0) {
      try {
        const { callAI } = require('../services/aiService');
        // Process in batches of 5 to avoid token limits
        for (let i = 0; i < textAnswers.length; i += 5) {
          const batch = textAnswers.slice(i, i + 5);
          const assessPrompts = batch.map(({ ans, q, rawAnswer }, idx) => {
            const rubric = q.scoring_rubric || `Score 0-${q.marks || 1} based on correctness and completeness.`;
            const sampleAnswer = q.sample_answer ? `\nSAMPLE ANSWER: ${q.sample_answer}` : '';
            return `Q${idx + 1}: ${q.question_text}
USER ANSWER: ${rawAnswer || '(no answer)'}
CORRECT ANSWER: ${q.correct_answer}
MARKS AVAILABLE: ${q.marks || 1}
SCORING RUBRIC: ${rubric}${sampleAnswer}
Return JSON: {"score": <0-${q.marks || 1}>, "feedback": "<brief feedback>"}`;
          });

          const assessPrompt = `You are Dr. Q, an expert Nigerian QS examiner. Assess these student answers.
Return a JSON array with one object per question, each with "score" (number) and "feedback" (string).
No markdown. Just the JSON array.

${assessPrompts.join('\n\n')}`;

          const raw = await callAI(assessPrompt, { temperature: 0.2 });
          let assessments = [];
          try {
            assessments = JSON.parse(stripJsonFences(raw));
            if (!Array.isArray(assessments)) assessments = [assessments];
          } catch { /* AI parsing failed, score as 0 */ }

          batch.forEach(({ ans, q, rawAnswer }, idx) => {
            const questionMarks = q.marks || 1;
            totalMarks += questionMarks;
            const assessment = assessments[idx] || {};
            const score = Math.min(Math.max(parseInt(assessment.score) || 0, 0), questionMarks);
            const isCorrect = score >= questionMarks * 0.5;

            if (isCorrect) {
              earnedMarks += score;
              correctCount++;
            }

            detailedResults.push({
              question_id: ans.question_id,
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options,
              user_answer: rawAnswer,
              correct_answer: q.correct_answer,
              is_correct: isCorrect,
              marks_earned: score,
              marks_possible: questionMarks,
              ai_feedback: assessment.feedback || '',
              explanation: q.explanation,
              difficulty: q.difficulty,
              topic: q.topic
            });
          });
        }
      } catch (aiErr) {
        logger.warn('AI assessment failed for text answers, scoring as 0', { error: aiErr.message });
        // Fallback: score text answers as 0
        for (const { ans, q, rawAnswer } of textAnswers) {
          const questionMarks = q.marks || 1;
          totalMarks += questionMarks;
          detailedResults.push({
            question_id: ans.question_id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            user_answer: rawAnswer,
            correct_answer: q.correct_answer,
            is_correct: false,
            marks_earned: 0,
            marks_possible: questionMarks,
            ai_feedback: 'AI assessment unavailable',
            explanation: q.explanation,
            difficulty: q.difficulty,
            topic: q.topic
          });
        }
      }
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

// ─── AI Question Explanation ──────────────────────────────────

exports.explainQuestion = async (req, res, _next) => {
  try {
    const { question_text, correct_answer, user_answer } = req.body;

    const prompt = `You are Dr. Q, an expert Nigerian Quantity Surveying examiner. A student got this exam question wrong. Provide a clear, detailed explanation.

QUESTION: ${question_text}
CORRECT ANSWER: ${correct_answer}
${user_answer ? `STUDENT'S ANSWER: ${user_answer}` : ''}

INSTRUCTIONS:
1. Explain WHY the correct answer is correct, with specific Nigerian QS context (SMM7, NRM2, local standards).
2. If the student gave a wrong answer, explain why it is incorrect.
3. Use Naira amounts, local materials, and Nigerian standards where relevant.
4. Keep the explanation concise but thorough — aim for 2-4 paragraphs.
5. Do NOT include any prefixes like "Explanation:" or numbering.

Return ONLY the explanation text.`;

    const { callAI } = require('../services/aiService');
    const explanation = await callAI(prompt, { temperature: 0.4 });

    return res.json(success('Explanation', {
      explanation: explanation || 'No explanation available at this time.'
    }));
  } catch (err) {
    logger.warn('AI explanation generation failed', { error: err.message });
    return res.json(success('Explanation', {
      explanation: 'AI explanation is temporarily unavailable. Please try the "Ask Dr. Q" feature for follow-up questions.'
    }));
  }
};

// ─── Personalized Practice Exam ────────────────────────────────
// Analyzes weak areas from past attempts and generates targeted practice

exports.generatePracticeExam = async (req, res, _next) => {
  try {
    const { category, question_count = 10 } = req.body;
    const count = Math.min(Math.max(parseInt(question_count) || 10, 5), 200);

    // 1. Analyze past attempts for weak topics (optional — works without history)
    let weakTopics = [];
    let topicStats = {};

    let attemptQuery = supabase
      .from('exam_attempts')
      .select('detailed_results, exam_category')
      .eq('user_id', req.user.id)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: false })
      .limit(20);

    if (category) attemptQuery = attemptQuery.eq('exam_category', category);

    const { data: attempts } = await attemptQuery;
    if (attempts && attempts.length > 0) {
      for (const attempt of attempts) {
        for (const r of (attempt.detailed_results || [])) {
          const topic = r.topic || 'general';
          if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
          topicStats[topic].total++;
          if (r.is_correct) topicStats[topic].correct++;
        }
      }

      weakTopics = Object.entries(topicStats)
        .map(([topic, s]) => ({ topic, accuracy: s.total > 0 ? s.correct / s.total : 0, total: s.total }))
        .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
        .slice(0, 8)
        .map(t => t.topic);
    }

    // 2. Use AI to generate targeted questions
    const { callAI, buildUserContext, SYSTEM_PROMPTS } = require('../services/aiService');
    const userContext = await buildUserContext(req.user.id);

    // Collect previously seen topics and question texts from past attempts to avoid repetition
    const seenTopics = [...new Set(attempts?.flatMap(a =>
      (a.detailed_results || []).map(r => r.topic).filter(Boolean)
    ) || [])];

    const seenQuestionTexts = attempts?.flatMap(a =>
      (a.detailed_results || []).map(r => r.question_text).filter(Boolean)
    ) || [];
    const uniqueSeenTexts = [...new Set(seenQuestionTexts)].slice(0, 30);

    const hasWeakTopics = weakTopics.length > 0;
    const topicInstruction = hasWeakTopics
      ? `WEAK TOPICS (ranked by lowest accuracy):
${weakTopics.map((t, i) => `${i + 1}. ${t} (${Math.round((topicStats[t]?.accuracy || 0) * 100)}% accuracy)`).join('\n')}
Prioritize these weak topics but ALSO include questions from other areas for variety.`
      : 'Cover a broad range of QS topics — measurement, valuation, contracts, materials, project management, construction law, professional practice.';

    const seenTopicsSection = seenTopics.length > 0
      ? `\nPREVIOUSLY SEEN TOPICS (avoid repeating these exact topics — pick FRESH ones):\n${seenTopics.join(', ')}`
      : '';

    const seenTextsSection = uniqueSeenTexts.length > 0
      ? `\nAVOID THESE EXACT QUESTIONS (do NOT generate similar or identical):\n${uniqueSeenTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
      : '';

    const personalizedContext = `USER CONTEXT:\n${userContext}

${topicInstruction}${seenTopicsSection}${seenTextsSection}

Generate exactly ${count} questions.
EVERY question must be from a DIFFERENT topic. No two questions from the same sub-topic.
Mix difficulty: 30% easy, 50% medium, 20% hard.`;

    const prompt = `${SYSTEM_PROMPTS.practiceExam || SYSTEM_PROMPTS.admissionTest}\n\n${personalizedContext}`;

    let questions;
    try {
      const raw = await callAI(prompt, { temperature: 0.8 });
      if (raw) {
        const parsed = JSON.parse(stripJsonFences(raw));
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Dedup: remove questions similar to previously seen ones
          const seenSet = new Set(uniqueSeenTexts.map(t => t.toLowerCase().trim()));
          questions = parsed
            .filter(q => {
              const text = (q.question || '').replace(/^\d+\.\s*/, '').trim().toLowerCase();
              return text.length > 10 && !seenSet.has(text);
            })
            .map(q => ({
              ...q,
              question: (q.question || '').replace(/^\d+\.\s*/, '').trim(),
              correct_answer: extractAnswerLetter(q.correct_answer)
            }));
        }
      }
    } catch (aiErr) {
      logger.warn('AI practice exam generation failed, falling back to DB', { error: aiErr.message });
    }

    // Fallback: pick random questions, prioritizing weak topics but avoiding repetition
    if (!questions || questions.length === 0) {
      // Try weak topics first
      if (weakTopics.length > 0) {
        let fallbackQ = supabase
          .from('exam_questions')
          .select('question_text, options, correct_answer, explanation, difficulty, topic')
          .in('topic', weakTopics.slice(0, 5))
          .not('correct_answer', 'is', null)
          .order('id') // deterministic order for offset
          .limit(count * 3); // fetch more for randomization

        const { data: fallbackQuestions } = await fallbackQ;
        if (fallbackQuestions && fallbackQuestions.length > 0) {
          const shuffled = shuffleArray(fallbackQuestions).slice(0, count);
          questions = shuffled.map(q => ({
            question: q.question_text,
            options: q.options,
            correct_answer: extractAnswerLetter(q.correct_answer),
            explanation: q.explanation,
            difficulty: q.difficulty,
            topic: q.topic
          }));
        }
      }

      // Broader fallback: random from all questions
      if (!questions || questions.length === 0) {
        let randomQ = supabase
          .from('exam_questions')
          .select('question_text, options, correct_answer, explanation, difficulty, topic')
          .not('correct_answer', 'is', null)
          .order('id')
          .limit(count * 5);

        if (category) randomQ = randomQ.eq('exam_category', category);

        const { data: randomQuestions } = await randomQ;
        if (randomQuestions && randomQuestions.length > 0) {
          const shuffled = shuffleArray(randomQuestions).slice(0, count);
          questions = shuffled.map(q => ({
            question: q.question_text,
            options: q.options,
            correct_answer: extractAnswerLetter(q.correct_answer),
            explanation: q.explanation,
            difficulty: q.difficulty,
            topic: q.topic
          }));
        }
      }
    }

    if (!questions || questions.length === 0) {
      return res.status(500).json(error('Failed to generate practice exam. Please try again.'));
    }

    return res.json(success('Practice exam generated', {
      questions: questions.map((q, idx) => ({
        index: idx,
        question: q.question,
        options: q.options,
        topic: q.topic,
        difficulty: q.difficulty
      })),
      weak_topics: weakTopics.slice(0, 5),
      total_questions: questions.length,
      requested_count: count,
      // Store correct answers for scoring (hidden from user during exam)
      _answers: questions.map(q => ({
        question_index: questions.indexOf(q),
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        topic: q.topic
      }))
    }));
  } catch (err) { _next(err); }
};

// ─── Attempts ──────────────────────────────────────────────────

exports.getAttempts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('exam_attempts')
      .select('id, exam_id, score, percentage, earned_marks, total_marks, correct_count, total_questions, is_trial, status, time_spent_seconds, started_at, submitted_at, exam:exam_definitions(exam_name, category)', { count: 'exact' })
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
    // Use multiple matching strategies for better accuracy
    const courseCodes = (courses || []).map(c => c.code).filter(Boolean);
    let questionCounts = {};
    
    if (courseCodes.length > 0) {
      // Strategy 1: Count questions linked via exam_definitions
      const { data: examDefs } = await supabase
        .from('exam_definitions')
        .select('id, course_id')
        .eq('university_id', id)
        .eq('is_published', true);
      
      const examIds = (examDefs || []).map(e => e.id).filter(Boolean);
      
      if (examIds.length > 0) {
        const { data: questionsViaExam } = await supabase
          .from('exam_questions')
          .select('exam_id')
          .eq('is_active', true)
          .in('exam_id', examIds);
        
        // Map exam_id back to course_id
        const examToCourse = {};
        (examDefs || []).forEach(e => {
          if (e.course_id) examToCourse[e.id] = e.course_id;
        });
        
        (questionsViaExam || []).forEach(q => {
          const courseId = examToCourse[q.exam_id];
          if (courseId) {
            questionCounts[courseId] = (questionCounts[courseId] || 0) + 1;
          }
        });
      }
      
      // Strategy 2: Also count by direct course_code matching in exam_questions
      const { data: questionsByCode } = await supabase
        .from('exam_questions')
        .select('course_code, university')
        .eq('is_active', true)
        .in('course_code', courseCodes);

      const normalizedName = university.name.toLowerCase().replace(/,/g, '').trim();
      const shortName = (university.short_name || '').toLowerCase().trim();

      (questionsByCode || []).forEach(q => {
        const qUni = (q.university || '').toLowerCase().replace(/,/g, '').trim();
        // Match if normalized names are equal, or one contains the other, or short name matches
        const nameMatch = qUni === normalizedName || 
                         normalizedName.includes(qUni) || 
                         qUni.includes(normalizedName) ||
                         (shortName && shortName.length >= 3 && (qUni.includes(shortName) || shortName.includes(qUni)));
        if (nameMatch) {
          const code = q.course_code;
          if (code) {
            // Find the course ID for this code
            const course = courses.find(c => c.code === code);
            if (course) {
              questionCounts[course.id] = (questionCounts[course.id] || 0) + 1;
            }
          }
        }
      });
    }

    const enriched = (courses || []).map(c => ({
      ...c,
      question_count: questionCounts[c.id] || questionCounts[c.code] || 0
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
