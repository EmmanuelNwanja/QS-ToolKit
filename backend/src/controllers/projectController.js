const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const { singleOrNull } = require('../utils/supabaseQuery');
const logger = require('../utils/logger');

const TRACKED_FIELDS = ['title', 'client_name', 'client_email', 'project_type', 'location', 'state', 'description', 'start_date', 'end_date', 'estimated_value', 'final_value', 'status'];

exports.list = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, count, error: err } = await query;
    if (err) throw err;

    return res.json(success('Projects retrieved', {
      projects: data,
      pagination: { total: count, page: +page, limit: +limit, pages: Math.ceil(count / limit) }
    }));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const payload = { ...req.body, user_id: req.user.id };
    if (req.user.organization_id) payload.organization_id = req.user.organization_id;

    const { data, error: err } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();

    if (err) throw err;
    return res.status(201).json(success('Project created', { project: data }));
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const data = await singleOrNull(
      supabase
      .from('projects')
      .select('*, boq_documents(*), invoices(id, invoice_type, total_amount, status), feedback_links(id, is_active), project_milestones(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    );

    if (!data) return res.status(404).json(error('Project not found', { code: 'PROJECT_NOT_FOUND' }));
    return res.json(success('Project details', { project: data }));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    // Fetch current state before update
    const current = await singleOrNull(
      supabase.from('projects').select('*').eq('id', req.params.id).eq('user_id', req.user.id)
    );

    if (!current) return res.status(404).json(error('Project not found', { code: 'PROJECT_NOT_FOUND' }));

    // Capture diff for tracked fields
    const historyRows = [];
    for (const field of TRACKED_FIELDS) {
      if (req.body[field] !== undefined && String(req.body[field]) !== String(current[field])) {
        historyRows.push({
          project_id: current.id,
          user_id: req.user.id,
          field_name: field,
          old_value: current[field] != null ? String(current[field]) : null,
          new_value: req.body[field] != null ? String(req.body[field]) : null
        });
      }
    }

    // Insert history records
    if (historyRows.length > 0) {
      const { error: histErr } = await supabase.from('project_edit_history').insert(historyRows);
      if (histErr) logger.warn('Failed to record project edit history:', histErr.message);
    }

    // Perform update
    const data = await singleOrNull(
      supabase
      .from('projects')
      .update({ ...req.body, updated_at: new Date() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
    );

    return res.json(success('Project updated', { project: data }));
  } catch (err) { next(err); }
};

exports.history = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('project_edit_history')
      .select('*')
      .eq('project_id', req.params.id)
      .eq('user_id', req.user.id)
      .order('edited_at', { ascending: false })
      .limit(100);

    if (err) throw err;
    return res.json(success('Edit history', { history: data }));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const { error: err } = await supabase
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (err) throw err;
    return res.json(success('Project deleted'));
  } catch (err) { next(err); }
};

exports.stats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [{ count: total }, { count: active }, { count: completed }, { data: values }] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
      supabase.from('projects').select('final_value, estimated_value').eq('user_id', userId)
    ]);

    const totalValue = values?.reduce((s, p) => s + (p.final_value || p.estimated_value || 0), 0) || 0;

    return res.json(success('Project stats', { stats: { total, active, completed, total_value: totalValue } }));
  } catch (err) { next(err); }
};
