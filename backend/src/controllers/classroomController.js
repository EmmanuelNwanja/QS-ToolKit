const { supabase } = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const { generateLessonOutline } = require('../services/outlineGenerator');
const { generateSceneContent } = require('../services/sceneGenerator');
const { getSceneType, getAllSceneTypes } = require('../services/sceneRegistry');
const { createSession, orchestrateDiscussion } = require('../services/agentOrchestrator');

// ─── Scene Types ─────────────────────────────────────────────

exports.getSceneTypes = async (req, res, next) => {
  try {
    const types = getAllSceneTypes();
    return res.json(success('Scene types', { scene_types: types }));
  } catch (err) { next(err); }
};

// ─── Outline Generation ──────────────────────────────────────

exports.generateOutline = async (req, res, next) => {
  try {
    const { topic, target_scene_types, difficulty, scene_count } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json(error('topic is required'));
    }

    const outline = await generateLessonOutline({
      topic: topic.trim(),
      target_scene_types: target_scene_types || [],
      difficulty: difficulty || 'intermediate',
      scene_count: scene_count || 5,
    });

    const { data: saved, error: insertErr } = await supabase
      .from('classroom_outlines')
      .insert({
        user_id: req.user.id,
        topic: topic.trim(),
        outline_data: outline,
        difficulty: difficulty || 'intermediate',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.status(201).json(success('Outline generated', { outline: saved }));
  } catch (err) { next(err); }
};

// ─── Accept Outline → Lesson + Scenes ────────────────────────

exports.acceptOutline = async (req, res, next) => {
  try {
    const { outlineId } = req.params;

    const { data: outline, error: fetchErr } = await supabase
      .from('classroom_outlines')
      .select('*')
      .eq('id', outlineId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !outline) {
      return res.status(404).json(error('Outline not found'));
    }

    const outlineData = outline.outline_data;
    const scenes = outlineData.scenes || [];

    const { data: lesson, error: lessonErr } = await supabase
      .from('classroom_lessons')
      .insert({
        user_id: req.user.id,
        title: outlineData.title || outline.topic,
        description: outlineData.description || '',
        topic: outline.topic,
        difficulty: outline.difficulty,
        outline_id: outline.id,
        total_scenes: scenes.length,
        completed_scenes: 0,
        overall_score: null,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (lessonErr) throw lessonErr;

    if (scenes.length > 0) {
      const sceneRows = scenes.map((s, idx) => ({
        lesson_id: lesson.id,
        scene_type: s.scene_type,
        title: s.title,
        description: s.description || '',
        sort_order: idx,
        content: null,
        user_responses: null,
        score: null,
        ai_feedback: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }));

      const { data: savedScenes, error: sceneErr } = await supabase
        .from('classroom_scenes')
        .insert(sceneRows)
        .select();

      if (sceneErr) throw sceneErr;

      return res.status(201).json(success('Lesson created', {
        lesson,
        scenes: savedScenes,
      }));
    }

    return res.status(201).json(success('Lesson created', { lesson, scenes: [] }));
  } catch (err) { next(err); }
};

// ─── List Lessons ────────────────────────────────────────────

exports.getLessons = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { data: lessons, count, error: err } = await supabase
      .from('classroom_lessons')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (err) throw err;

    return res.json(success('Lessons', {
      lessons: lessons || [],
      total: count || 0,
      page,
      limit,
    }));
  } catch (err) { next(err); }
};

// ─── Get Single Lesson ───────────────────────────────────────

exports.getLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    const { data: lesson, error: err } = await supabase
      .from('classroom_lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('user_id', req.user.id)
      .single();

    if (err || !lesson) {
      return res.status(404).json(error('Lesson not found'));
    }

    const { data: scenes, error: sceneErr } = await supabase
      .from('classroom_scenes')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sort_order');

    if (sceneErr) throw sceneErr;

    return res.json(success('Lesson', { lesson, scenes: scenes || [] }));
  } catch (err) { next(err); }
};

// ─── Generate Scene Content ──────────────────────────────────

exports.generateSceneContent = async (req, res, next) => {
  try {
    const { sceneId } = req.params;

    const { data: scene, error: fetchErr } = await supabase
      .from('classroom_scenes')
      .select('*, lesson:classroom_lessons(id, topic, difficulty)')
      .eq('id', sceneId)
      .single();

    if (fetchErr || !scene) {
      return res.status(404).json(error('Scene not found'));
    }

    if (scene.lesson?.user_id !== req.user.id) {
      return res.status(403).json(error('Access denied'));
    }

    const sceneType = getSceneType(scene.scene_type);
    if (!sceneType) {
      return res.status(400).json(error(`Unknown scene type: ${scene.scene_type}`));
    }

    const content = await generateSceneContent({
      scene_type: scene.scene_type,
      title: scene.title,
      description: scene.description,
      topic: scene.lesson?.topic,
      difficulty: scene.lesson?.difficulty,
      scene_config: sceneType.config,
    });

    const { data: updated, error: updateErr } = await supabase
      .from('classroom_scenes')
      .update({
        content,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sceneId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return res.json(success('Scene content generated', { scene: updated }));
  } catch (err) { next(err); }
};

// ─── Submit Scene Response ───────────────────────────────────

exports.submitSceneResponse = async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const { responses } = req.body;

    if (!responses) {
      return res.status(400).json(error('responses is required'));
    }

    const { data: scene, error: fetchErr } = await supabase
      .from('classroom_scenes')
      .select('*, lesson:classroom_lessons(id, user_id, completed_scenes, total_scenes)')
      .eq('id', sceneId)
      .single();

    if (fetchErr || !scene) {
      return res.status(404).json(error('Scene not found'));
    }

    if (scene.lesson?.user_id !== req.user.id) {
      return res.status(403).json(error('Access denied'));
    }

    const sceneType = getSceneType(scene.scene_type);
    let score = null;
    let aiFeedback = null;
    let status = 'completed';

    const autoGradable = ['quiz', 'mcq'];
    const aiGradable = ['boq', 'rate_analysis', 'measurement', 'cost_plan'];
    const noGrade = ['lecture', 'pbl', 'discussion'];

    if (autoGradable.includes(scene.scene_type)) {
      const content = scene.content || {};
      const questions = content.questions || [];
      const answerMap = {};
      if (Array.isArray(responses)) {
        responses.forEach(r => {
          answerMap[r.question_index] = r.answer;
        });
      } else if (typeof responses === 'object') {
        Object.assign(answerMap, responses);
      }

      let correct = 0;
      questions.forEach((q, idx) => {
        const userAns = String(answerMap[idx] || '').trim().toUpperCase();
        const correctAns = String(q.correct_answer || '').trim().toUpperCase();
        if (userAns && userAns === correctAns) correct++;
      });

      score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
      aiFeedback = { correct_count: correct, total: questions.length };
    } else if (aiGradable.includes(scene.scene_type)) {
      // AI grading placeholder — call your grading service here
      // For now, store responses and mark as needing review
      score = null;
      aiFeedback = { status: 'pending_review', responses };
    } else if (noGrade.includes(scene.scene_type)) {
      score = null;
      aiFeedback = null;
    }

    const { error: updateErr } = await supabase
      .from('classroom_scenes')
      .update({
        user_responses: responses,
        score,
        ai_feedback: aiFeedback,
        status,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', sceneId);

    if (updateErr) throw updateErr;

    // Update lesson progress
    const lessonId = scene.lesson?.id;
    if (lessonId) {
      const { data: completedScenes } = await supabase
        .from('classroom_scenes')
        .select('id, score')
        .eq('lesson_id', lessonId)
        .eq('status', 'completed');

      const completedCount = (completedScenes || []).length;
      const scores = (completedScenes || []).map(s => s.score).filter(s => s !== null);
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      await supabase
        .from('classroom_lessons')
        .update({
          completed_scenes: completedCount,
          overall_score: avgScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lessonId);
    }

    return res.json(success('Response submitted', {
      score,
      ai_feedback: aiFeedback,
      status,
    }));
  } catch (err) { next(err); }
};

// ─── Discussion Start ────────────────────────────────────────

exports.startDiscussion = async (req, res, next) => {
  try {
    const { sceneId } = req.params;

    const { data: scene, error: fetchErr } = await supabase
      .from('classroom_scenes')
      .select('*, lesson:classroom_lessons(id, user_id, topic)')
      .eq('id', sceneId)
      .single();

    if (fetchErr || !scene) {
      return res.status(404).json(error('Scene not found'));
    }

    if (scene.lesson?.user_id !== req.user.id) {
      return res.status(403).json(error('Access denied'));
    }

    const session = await createSession({
      scene_id: sceneId,
      user_id: req.user.id,
      topic: scene.lesson?.topic || scene.title,
      scene_type: scene.scene_type,
    });

    const initialMessages = await orchestrateDiscussion(session.id, null);

    return res.status(201).json(success('Discussion started', {
      session,
      messages: initialMessages,
    }));
  } catch (err) { next(err); }
};

// ─── Discussion Continue ─────────────────────────────────────

exports.continueDiscussion = async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const { session_id, user_message } = req.body;

    if (!session_id || !user_message) {
      return res.status(400).json(error('session_id and user_message are required'));
    }

    const { data: session, error: sessErr } = await supabase
      .from('classroom_discussion_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('scene_id', sceneId)
      .single();

    if (sessErr || !session) {
      return res.status(404).json(error('Discussion session not found'));
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json(error('Access denied'));
    }

    const agentMessages = await orchestrateDiscussion(session_id, user_message);

    return res.json(success('Discussion continued', {
      messages: agentMessages,
    }));
  } catch (err) { next(err); }
};

// ─── Lesson Progress ─────────────────────────────────────────

exports.getLessonProgress = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    const { data: lesson, error: err } = await supabase
      .from('classroom_lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('user_id', req.user.id)
      .single();

    if (err || !lesson) {
      return res.status(404).json(error('Lesson not found'));
    }

    const { data: scenes, error: sceneErr } = await supabase
      .from('classroom_scenes')
      .select('id, scene_type, title, status, score, sort_order, submitted_at')
      .eq('lesson_id', lessonId)
      .order('sort_order');

    if (sceneErr) throw sceneErr;

    const completed = (scenes || []).filter(s => s.status === 'completed');
    const totalScenes = (scenes || []).length;
    const scores = completed.map(s => s.score).filter(s => s !== null);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Time spent: difference between first submission and lesson creation
    let timeSpentMinutes = null;
    const firstSubmit = completed
      .map(s => s.submitted_at)
      .filter(Boolean)
      .sort()[0];
    if (firstSubmit) {
      const start = new Date(lesson.created_at).getTime();
      const end = new Date(firstSubmit).getTime();
      timeSpentMinutes = Math.round((end - start) / 60000);
    }

    return res.json(success('Lesson progress', {
      lesson_id: lesson.id,
      title: lesson.title,
      total_scenes: totalScenes,
      completed_scenes: completed.length,
      progress_percent: totalScenes > 0 ? Math.round((completed.length / totalScenes) * 100) : 0,
      overall_score: avgScore,
      time_spent_minutes: timeSpentMinutes,
      scenes: scenes || [],
    }));
  } catch (err) { next(err); }
};

// ─── Delete Lesson (soft) ────────────────────────────────────

exports.deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    const { data: lesson, error: fetchErr } = await supabase
      .from('classroom_lessons')
      .select('id, user_id')
      .eq('id', lessonId)
      .single();

    if (fetchErr || !lesson) {
      return res.status(404).json(error('Lesson not found'));
    }

    if (lesson.user_id !== req.user.id) {
      return res.status(403).json(error('Access denied'));
    }

    const { error: updateErr } = await supabase
      .from('classroom_lessons')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', lessonId);

    if (updateErr) throw updateErr;

    return res.json(success('Lesson archived'));
  } catch (err) { next(err); }
};

// ─── Analytics ───────────────────────────────────────────────

exports.getAnalytics = async (req, res, next) => {
  try {
    const { data: lessons } = await supabase
      .from('classroom_lessons')
      .select('id, overall_score, completed_scenes, total_scenes, created_at')
      .eq('user_id', req.user.id)
      .neq('status', 'archived');

    const allLessonIds = (lessons || []).map(l => l.id);
    let scenes = [];
    if (allLessonIds.length > 0) {
      const { data } = await supabase
        .from('classroom_scenes')
        .select('id, scene_type, score, status')
        .in('lesson_id', allLessonIds);
      scenes = data || [];
    }

    const totalLessons = (lessons || []).length;
    const scores = (lessons || []).map(l => l.overall_score).filter(s => s !== null);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Scene type breakdown
    const typeBreakdown = {};
    scenes.forEach(s => {
      if (!typeBreakdown[s.scene_type]) {
        typeBreakdown[s.scene_type] = { total: 0, completed: 0, avg_score: null, scores: [] };
      }
      typeBreakdown[s.scene_type].total++;
      if (s.status === 'completed') {
        typeBreakdown[s.scene_type].completed++;
        if (s.score !== null) typeBreakdown[s.scene_type].scores.push(s.score);
      }
    });
    Object.keys(typeBreakdown).forEach(type => {
      const b = typeBreakdown[type];
      b.avg_score = b.scores.length > 0
        ? Math.round(b.scores.reduce((a, c) => a + c, 0) / b.scores.length)
        : null;
      delete b.scores;
    });

    // Total completed scenes across all lessons
    const totalCompletedScenes = (lessons || []).reduce((sum, l) => sum + (l.completed_scenes || 0), 0);
    const totalScenes = (lessons || []).reduce((sum, l) => sum + (l.total_scenes || 0), 0);

    return res.json(success('Analytics', {
      total_lessons: totalLessons,
      avg_score: avgScore,
      total_scenes: totalScenes,
      completed_scenes: totalCompletedScenes,
      scene_type_breakdown: typeBreakdown,
    }));
  } catch (err) { next(err); }
};
