const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');

async function ensureProjectOwnership(projectId, userId) {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

exports.list = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const canAccess = await ensureProjectOwnership(projectId, req.user.id);
    if (!canAccess) return res.status(404).json(error('Project not found'));

    const { data, error: dbError } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (dbError) throw dbError;
    return res.json(success('Project milestones', { milestones: data || [] }));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const canAccess = await ensureProjectOwnership(projectId, req.user.id);
    if (!canAccess) return res.status(404).json(error('Project not found'));

    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json(error('Milestone title is required'));

    const payload = {
      project_id: projectId,
      title,
      note: req.body.note || null,
      status: req.body.status || 'planned',
      due_date: req.body.due_date || null,
      sort_order: Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0
    };

    if (!['planned', 'in_progress', 'completed'].includes(payload.status)) {
      return res.status(400).json(error('Invalid milestone status'));
    }

    if (payload.status === 'completed') {
      payload.completed_at = new Date().toISOString();
    }

    const { data, error: dbError } = await supabase
      .from('project_milestones')
      .insert(payload)
      .select()
      .single();

    if (dbError) throw dbError;
    return res.status(201).json(success('Milestone created', { milestone: data }));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { milestoneId } = req.params;

    const canAccess = await ensureProjectOwnership(projectId, req.user.id);
    if (!canAccess) return res.status(404).json(error('Project not found'));

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (req.body.title !== undefined) updates.title = String(req.body.title || '').trim();
    if (req.body.note !== undefined) updates.note = req.body.note;
    if (req.body.due_date !== undefined) updates.due_date = req.body.due_date || null;
    if (req.body.sort_order !== undefined) updates.sort_order = Number(req.body.sort_order) || 0;

    if (req.body.status !== undefined) {
      if (!['planned', 'in_progress', 'completed'].includes(req.body.status)) {
        return res.status(400).json(error('Invalid milestone status'));
      }
      updates.status = req.body.status;
      updates.completed_at = req.body.status === 'completed' ? new Date().toISOString() : null;
    }

    if (updates.title === '') {
      return res.status(400).json(error('Milestone title is required'));
    }

    const { data, error: dbError } = await supabase
      .from('project_milestones')
      .update(updates)
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (dbError || !data) return res.status(404).json(error('Milestone not found'));
    return res.json(success('Milestone updated', { milestone: data }));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { milestoneId } = req.params;

    const canAccess = await ensureProjectOwnership(projectId, req.user.id);
    if (!canAccess) return res.status(404).json(error('Project not found'));

    const { error: dbError } = await supabase
      .from('project_milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('project_id', projectId);

    if (dbError) throw dbError;
    return res.json(success('Milestone deleted'));
  } catch (err) { next(err); }
};
