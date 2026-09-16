const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const { generateLessonOutline } = require('../services/outlineGenerator');
const { generateSceneContent } = require('../services/sceneGenerator');
const { getSceneType } = require('../services/sceneRegistry');

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const PASS_THRESHOLD = 70;

function levelIndex(level) {
  return LEVELS.indexOf(level);
}

function nextLevel(level) {
  const idx = levelIndex(level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

// ─── List Courses with User Progress ─────────────────────────

const getCourses = async (req, res, next) => {
  try {
    const { data: courses, error: courseErr } = await supabase
      .from('classroom_courses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (courseErr) throw courseErr;

    const { data: progress } = await supabase
      .from('classroom_user_progress')
      .select('course_id, current_level, completed_lessons, total_score, is_completed')
      .eq('user_id', req.user.id);

    const progressMap = {};
    (progress || []).forEach(p => { progressMap[p.course_id] = p; });

    const enriched = (courses || []).map(c => ({
      ...c,
      user_progress: progressMap[c.id] || null,
    }));

    return res.json(success('Courses', { courses: enriched }));
  } catch (err) { next(err); }
};

// ─── Start a Course ──────────────────────────────────────────

const startCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const { data: course, error: courseErr } = await supabase
      .from('classroom_courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseErr || !course) {
      return res.status(404).json(error('Course not found'));
    }

    // Check if already started
    const { data: existing } = await supabase
      .from('classroom_user_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .single();

    let progress = existing;

    if (!progress) {
      const { data: created, error: createErr } = await supabase
        .from('classroom_user_progress')
        .insert({
          user_id: req.user.id,
          course_id: courseId,
          current_level: 'beginner',
          completed_lessons: 0,
          total_score: 0,
          unlocked_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) throw createErr;
      progress = created;
    }

    // Generate first lesson for current level
    const lesson = await generateCourseLesson(course, progress, req.user.id);

    return res.status(201).json(success('Course started', {
      progress,
      lesson,
    }));
  } catch (err) { next(err); }
};

// ─── Get Next Lesson for a Course ────────────────────────────

const getNextLesson = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const { data: course, error: courseErr } = await supabase
      .from('classroom_courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseErr || !course) {
      return res.status(404).json(error('Course not found'));
    }

    const { data: progress, error: progErr } = await supabase
      .from('classroom_user_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .single();

    if (progErr || !progress) {
      return res.status(404).json(error('Course not started. Call POST /classroom/courses/:courseId/start first.'));
    }

    if (progress.is_completed) {
      return res.status(400).json(error('Course already completed'));
    }

    const lesson = await generateCourseLesson(course, progress, req.user.id);

    return res.status(201).json(success('Next lesson generated', { lesson }));
  } catch (err) { next(err); }
};

// ─── Complete Level → Check Score & Advance ──────────────────

const completeLevel = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const { data: progress, error: progErr } = await supabase
      .from('classroom_user_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .single();

    if (progErr || !progress) {
      return res.status(404).json(error('Course progress not found'));
    }

    if (progress.is_completed) {
      return res.status(400).json(error('Course already completed'));
    }

    // Get all completed lessons at current level
    const { data: lessons } = await supabase
      .from('classroom_lessons')
      .select('id, score')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .eq('level', progress.current_level)
      .eq('status', 'completed');

    const scoredLessons = (lessons || []).filter(l => l.score !== null);

    if (scoredLessons.length === 0) {
      return res.status(400).json(error('No completed lessons with scores at this level'));
    }

    const avgScore = Math.round(
      scoredLessons.reduce((sum, l) => sum + Number(l.score), 0) / scoredLessons.length
    );

    if (avgScore < PASS_THRESHOLD) {
      return res.json(success('Level not yet passed', {
        current_level: progress.current_level,
        avg_score: avgScore,
        threshold: PASS_THRESHOLD,
        passed: false,
        message: `You need ${PASS_THRESHOLD}% to advance. Current: ${avgScore}%. Try another lesson.`,
      }));
    }

    // Passed — advance or complete
    const nl = nextLevel(progress.current_level);
    let updateFields;

    if (nl) {
      updateFields = {
        current_level: nl,
        total_score: avgScore,
        unlocked_at: new Date().toISOString(),
      };
    } else {
      updateFields = {
        is_completed: true,
        total_score: avgScore,
      };
    }

    const { error: updateErr } = await supabase
      .from('classroom_user_progress')
      .update(updateFields)
      .eq('id', progress.id);

    if (updateErr) throw updateErr;

    return res.json(success(nl ? 'Level unlocked!' : 'Course completed!', {
      current_level: nl || 'completed',
      avg_score: avgScore,
      passed: true,
      course_completed: !nl,
    }));
  } catch (err) { next(err); }
};

// ─── Course Progress ─────────────────────────────────────────

const getCourseProgress = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const { data: course } = await supabase
      .from('classroom_courses')
      .select('id, title, slug')
      .eq('id', courseId)
      .single();

    if (!course) return res.status(404).json(error('Course not found'));

    const { data: progress } = await supabase
      .from('classroom_user_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .single();

    if (!progress) {
      return res.json(success('Course progress', {
        course,
        started: false,
        current_level: null,
        lessons: [],
      }));
    }

    const { data: lessons } = await supabase
      .from('classroom_lessons')
      .select('id, title, level, status, score, completed_scenes, total_scenes, created_at')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    return res.json(success('Course progress', {
      course,
      started: true,
      progress,
      lessons: lessons || [],
    }));
  } catch (err) { next(err); }
};

// ─── Generate Custom Lesson (no course) ──────────────────────

const generateCustomLesson = async (req, res, next) => {
  try {
    const { topic, difficulty } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json(error('topic is required'));
    }

    const diff = difficulty || 'medium';
    const sceneTypes = ['lecture', 'quiz', 'boq', 'rate_analysis', 'measurement', 'cost_plan', 'pbl', 'discussion'];

    // Generate outline
    const outline = await generateLessonOutline(topic.trim(), sceneTypes, diff, 5);

    // Save outline
    const { data: savedOutline, error: outlineErr } = await supabase
      .from('classroom_outlines')
      .insert({
        user_id: req.user.id,
        topic: topic.trim(),
        outline: outline,
        difficulty: diff,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (outlineErr) throw outlineErr;

    // Create lesson (no course_id → custom)
    const { data: lesson, error: lessonErr } = await supabase
      .from('classroom_lessons')
      .insert({
        user_id: req.user.id,
        title: outline.title || topic.trim(),
        description: outline.description || '',
        topic: topic.trim(),
        difficulty: diff,
        outline_id: savedOutline.id,
        total_scenes: (outline.scenes || []).length,
        completed_scenes: 0,
        status: 'active',
        course_id: null,
        level: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (lessonErr) throw lessonErr;

    // Create scenes
    const scenes = outline.scenes || [];
    if (scenes.length > 0) {
      const sceneRows = scenes.map((s, idx) => ({
        lesson_id: lesson.id,
        scene_type: s.scene_type,
        title: s.title,
        description: s.description || '',
        order_index: idx,
        content: null,
        user_responses: null,
        score: null,
        ai_feedback: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }));

      const { error: sceneErr } = await supabase
        .from('classroom_scenes')
        .insert(sceneRows);

      if (sceneErr) throw sceneErr;
    }

    return res.status(201).json(success('Custom lesson created', {
      lesson_id: lesson.id,
      title: lesson.title,
      total_scenes: lesson.total_scenes,
    }));
  } catch (err) { next(err); }
};

// ─── Internal: Generate a lesson for a course at current level ─

async function generateCourseLesson(course, progress, userId) {
  const config = course.difficulty_config[progress.current_level];
  if (!config) throw new Error(`Invalid level: ${progress.current_level}`);

  const topicHint = config.topic_hint || course.title;
  const sceneTypes = config.scene_types || ['lecture', 'quiz'];
  const sceneCount = config.scene_count || 5;

  // Generate outline
  const outline = await generateLessonOutline(
    `${course.title} — ${topicHint}`,
    sceneTypes,
    progress.current_level,
    sceneCount
  );

  // Save outline
  const { data: savedOutline, error: outlineErr } = await supabase
    .from('classroom_outlines')
    .insert({
      user_id: userId,
      topic: course.title,
      outline: outline,
      difficulty: progress.current_level,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (outlineErr) throw outlineErr;

  // Create lesson
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .insert({
      user_id: userId,
      title: outline.title || `${course.title} — ${progress.current_level}`,
      description: outline.description || '',
      topic: course.title,
      difficulty: progress.current_level,
      outline_id: savedOutline.id,
      total_scenes: (outline.scenes || []).length,
      completed_scenes: 0,
      status: 'active',
      course_id: course.id,
      level: progress.current_level,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (lessonErr) throw lessonErr;

  // Create scenes
  const scenes = outline.scenes || [];
  if (scenes.length > 0) {
    const sceneRows = scenes.map((s, idx) => ({
      lesson_id: lesson.id,
      scene_type: s.scene_type,
      title: s.title,
      description: s.description || '',
      order_index: idx,
      content: null,
      user_responses: null,
      score: null,
      ai_feedback: null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    const { error: sceneErr } = await supabase
      .from('classroom_scenes')
      .insert(sceneRows);

    if (sceneErr) throw sceneErr;
  }

  return {
    lesson_id: lesson.id,
    title: lesson.title,
    total_scenes: lesson.total_scenes,
    level: progress.current_level,
  };
}

module.exports = {
  getCourses,
  startCourse,
  getNextLesson,
  completeLevel,
  getCourseProgress,
  generateCustomLesson,
};
