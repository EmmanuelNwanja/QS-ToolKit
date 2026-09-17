const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');

// ─── Helpers ─────────────────────────────────────────────────

async function alreadyMigrated(userId, sourceTable, sourceId) {
  const { data } = await supabase
    .from('classroom_lessons')
    .select('id')
    .eq('user_id', userId)
    .eq('metadata->>source_table', sourceTable)
    .eq('metadata->>source_id', sourceId)
    .maybeSingle();
  return !!data;
}

async function createLesson(userId, { title, description, topic, difficulty, sceneTypeFocus, sourceTable, sourceId, score }) {
  const { data: lesson, error: err } = await supabase
    .from('classroom_lessons')
    .insert({
      user_id: userId,
      title,
      description: description || '',
      topic: topic || title,
      difficulty: difficulty || 'intermediate',
      total_scenes: 0,
      completed_scenes: 0,
      overall_score: score || null,
      status: 'active',
      metadata: { source_table: sourceTable, source_id: sourceId, scene_type_focus: sceneTypeFocus },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (err) throw err;
  return lesson;
}

async function createScene(lessonId, { sceneType, title, description, content, score, sortOrder }) {
  const { data: scene, error: err } = await supabase
    .from('classroom_scenes')
    .insert({
      lesson_id: lessonId,
      scene_type: sceneType,
      title: title || sceneType,
      order_index: sortOrder || 0,
      content: content || null,
      score: score || null,
      status: content ? 'ready' : 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (err) throw err;
  return scene;
}

// ─── Migrate Exam Prep Attempt ───────────────────────────────

exports.migrateExamPrepAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;

    const { data: attempt, error: fetchErr } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !attempt) {
      return res.status(404).json(error('Exam attempt not found'));
    }

    if (await alreadyMigrated(req.user.id, 'exam_attempts', attemptId)) {
      return res.status(409).json(error('This attempt has already been migrated'));
    }

    const lesson = await createLesson(req.user.id, {
      title: attempt.exam_name || 'Exam Prep',
      description: `Migrated from exam attempt`,
      topic: attempt.exam_name || 'Exam Prep',
      sceneTypeFocus: 'exam_prep',
      sourceTable: 'exam_attempts',
      sourceId: attemptId,
      score: attempt.score || attempt.percentage || null,
    });

    const scene = await createScene(lesson.id, {
      sceneType: 'quiz',
      title: attempt.exam_name || 'Quiz',
      description: `Questions from exam attempt`,
      content: {
        questions: attempt.detailed_results || attempt.answers || [],
        exam_name: attempt.exam_name,
        exam_category: attempt.exam_category,
      },
      score: attempt.score || attempt.percentage || null,
      sortOrder: 0,
    });

    // Update lesson scene count
    await supabase
      .from('classroom_lessons')
      .update({ total_scenes: 1, completed_scenes: attempt.status === 'completed' ? 1 : 0 })
      .eq('id', lesson.id);

    return res.status(201).json(success('Exam attempt migrated', { lesson, scenes: [scene] }));
  } catch (err) { next(err); }
};

// ─── Migrate Academy Lesson ──────────────────────────────────

exports.migrateAcademyLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    const { data: academyLesson, error: fetchErr } = await supabase
      .from('academy_lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (fetchErr || !academyLesson) {
      return res.status(404).json(error('Academy lesson not found'));
    }

    if (await alreadyMigrated(req.user.id, 'academy_lessons', lessonId)) {
      return res.status(409).json(error('This lesson has already been migrated'));
    }

    const lesson = await createLesson(req.user.id, {
      title: academyLesson.title || 'Academy Lesson',
      description: academyLesson.description || '',
      topic: academyLesson.topic || academyLesson.title,
      difficulty: academyLesson.difficulty || 'intermediate',
      sceneTypeFocus: 'academy',
      sourceTable: 'academy_lessons',
      sourceId: lessonId,
    });

    const scenes = [];
    let sortOrder = 0;

    // Lecture scene from content
    if (academyLesson.content) {
      const lectureScene = await createScene(lesson.id, {
        sceneType: 'lecture',
        title: academyLesson.title || 'Lecture',
        description: academyLesson.description || '',
        content: academyLesson.content,
        sortOrder: sortOrder++,
      });
      scenes.push(lectureScene);
    }

    // Quiz scene from practice_questions
    if (academyLesson.practice_questions && academyLesson.practice_questions.length > 0) {
      const quizScene = await createScene(lesson.id, {
        sceneType: 'quiz',
        title: 'Practice Questions',
        description: 'Practice questions from this lesson',
        content: { questions: academyLesson.practice_questions },
        sortOrder: sortOrder++,
      });
      scenes.push(quizScene);
    }

    await supabase
      .from('classroom_lessons')
      .update({ total_scenes: scenes.length })
      .eq('id', lesson.id);

    return res.status(201).json(success('Academy lesson migrated', { lesson, scenes }));
  } catch (err) { next(err); }
};

// ─── Migrate Academy Simulation ──────────────────────────────

exports.migrateAcademySimulation = async (req, res, next) => {
  try {
    const { simId } = req.params;

    const { data: sim, error: fetchErr } = await supabase
      .from('academy_simulations')
      .select('*')
      .eq('id', simId)
      .single();

    if (fetchErr || !sim) {
      return res.status(404).json(error('Academy simulation not found'));
    }

    if (await alreadyMigrated(req.user.id, 'academy_simulations', simId)) {
      return res.status(409).json(error('This simulation has already been migrated'));
    }

    // Map simulation_type to scene_type
    const typeMap = {
      boq: 'boq',
      rate_analysis: 'rate_analysis',
      measurement: 'measurement',
      cost_plan: 'cost_plan',
      valuation: 'valuation',
    };
    const sceneType = typeMap[sim.simulation_type] || 'boq';

    const lesson = await createLesson(req.user.id, {
      title: sim.title || sim.simulation_type || 'Simulation',
      description: sim.description || '',
      topic: sim.simulation_type || 'Simulation',
      difficulty: sim.difficulty || 'intermediate',
      sceneTypeFocus: sceneType,
      sourceTable: 'academy_simulations',
      sourceId: simId,
    });

    const scene = await createScene(lesson.id, {
      sceneType,
      title: sim.title || sim.simulation_type,
      description: sim.description || '',
      content: sim.config || sim.simulation_config || null,
      score: sim.score || null,
      sortOrder: 0,
    });

    await supabase
      .from('classroom_lessons')
      .update({ total_scenes: 1, completed_scenes: sim.status === 'completed' ? 1 : 0 })
      .eq('id', lesson.id);

    return res.status(201).json(success('Academy simulation migrated', { lesson, scenes: [scene] }));
  } catch (err) { next(err); }
};

// ─── Bulk Migrate ────────────────────────────────────────────

exports.bulkMigrate = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const counts = { exam_attempts: 0, academy_lessons: 0, academy_simulations: 0, skipped: 0, errors: 0 };

    // Fetch all completed exam attempts
    const { data: examAttempts } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed');

    for (const a of (examAttempts || [])) {
      try {
        if (await alreadyMigrated(userId, 'exam_attempts', a.id)) { counts.skipped++; continue; }
        const attempt = await supabase.from('exam_attempts').select('*').eq('id', a.id).single();
        const att = attempt.data;
        const lesson = await createLesson(userId, {
          title: att.exam_name || 'Exam Prep',
          topic: att.exam_name || 'Exam Prep',
          sceneTypeFocus: 'exam_prep',
          sourceTable: 'exam_attempts', sourceId: a.id,
          score: att.score || att.percentage || null,
        });
        await createScene(lesson.id, {
          sceneType: 'quiz', title: att.exam_name || 'Quiz',
          content: { questions: att.detailed_results || att.answers || [], exam_name: att.exam_name },
          score: att.score || att.percentage || null,
        });
        await supabase.from('classroom_lessons').update({ total_scenes: 1, completed_scenes: 1 }).eq('id', lesson.id);
        counts.exam_attempts++;
      } catch { counts.errors++; }
    }

    // Fetch academy lessons
    const { data: academyLessons } = await supabase
      .from('academy_lessons')
      .select('id')
      .eq('user_id', userId);

    for (const l of (academyLessons || [])) {
      try {
        if (await alreadyMigrated(userId, 'academy_lessons', l.id)) { counts.skipped++; continue; }
        const { data: al } = await supabase.from('academy_lessons').select('*').eq('id', l.id).single();
        const lesson = await createLesson(userId, {
          title: al.title || 'Academy Lesson', description: al.description || '',
          topic: al.topic || al.title, sceneTypeFocus: 'academy',
          sourceTable: 'academy_lessons', sourceId: l.id,
        });
        let order = 0;
        if (al.content) {
          await createScene(lesson.id, { sceneType: 'lecture', title: al.title, content: al.content, sortOrder: order++ });
        }
        if (al.practice_questions?.length > 0) {
          await createScene(lesson.id, { sceneType: 'quiz', title: 'Practice Questions', content: { questions: al.practice_questions }, sortOrder: order++ });
        }
        await supabase.from('classroom_lessons').update({ total_scenes: order }).eq('id', lesson.id);
        counts.academy_lessons++;
      } catch { counts.errors++; }
    }

    // Fetch academy simulations
    const { data: sims } = await supabase
      .from('academy_simulations')
      .select('id')
      .eq('user_id', userId);

    const typeMap = { boq: 'boq', rate_analysis: 'rate_analysis', measurement: 'measurement', cost_plan: 'cost_plan', valuation: 'valuation' };

    for (const s of (sims || [])) {
      try {
        if (await alreadyMigrated(userId, 'academy_simulations', s.id)) { counts.skipped++; continue; }
        const { data: sim } = await supabase.from('academy_simulations').select('*').eq('id', s.id).single();
        const sceneType = typeMap[sim.simulation_type] || 'boq';
        const lesson = await createLesson(userId, {
          title: sim.title || sim.simulation_type || 'Simulation',
          topic: sim.simulation_type || 'Simulation', sceneTypeFocus: sceneType,
          sourceTable: 'academy_simulations', sourceId: s.id,
        });
        await createScene(lesson.id, {
          sceneType, title: sim.title || sim.simulation_type,
          content: sim.config || sim.simulation_config || null, score: sim.score || null,
        });
        await supabase.from('classroom_lessons').update({ total_scenes: 1 }).eq('id', lesson.id);
        counts.academy_simulations++;
      } catch { counts.errors++; }
    }

    const totalMigrated = counts.exam_attempts + counts.academy_lessons + counts.academy_simulations;

    return res.json(success('Bulk migration complete', {
      migrated: totalMigrated,
      counts,
    }));
  } catch (err) { next(err); }
};

// ─── Migration Status ────────────────────────────────────────

exports.getMigrationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [examAttempts, academyLessons, academySims, migrated] = await Promise.all([
      supabase.from('exam_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
      supabase.from('academy_lessons').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('academy_simulations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('classroom_lessons').select('metadata').eq('user_id', userId).not('metadata', 'is', null),
    ]);

    const migratedSources = new Set();
    (migrated.data || []).forEach(l => {
      const m = l.metadata;
      if (m?.source_table && m?.source_id) migratedSources.add(`${m.source_table}:${m.source_id}`);
    });

    const examCount = examAttempts.count || 0;
    const lessonCount = academyLessons.count || 0;
    const simCount = academySims.count || 0;

    return res.json(success('Migration status', {
      unmigrated: {
        exam_attempts: examCount,
        academy_lessons: lessonCount,
        academy_simulations: simCount,
        total: examCount + lessonCount + simCount,
      },
      already_migrated: migratedSources.size,
    }));
  } catch (err) { next(err); }
};
