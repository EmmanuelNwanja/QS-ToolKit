const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const { services } = require('../../modules/calculators');

// ================================================================
//  All QS Calculators — delegates to modules/calculators/services
// ================================================================

// ── Concrete Volume ────────────────────────────────────────────
exports.concrete = async (req, res, next) => {
  try {
    const result = services.Concrete.calculate(req.body);
    await logUsage(req.user.id, 'concrete');
    return res.json(success('Concrete calculation complete', result));
  } catch (err) { next(err); }
};

// ── Masonry / Blockwork ────────────────────────────────────────
exports.masonry = async (req, res, next) => {
  try {
    const result = services.Masonry.calculate(req.body);
    await logUsage(req.user.id, 'masonry');
    return res.json(success('Masonry calculation complete', result));
  } catch (err) { next(err); }
};

// ── Plastering / Rendering ─────────────────────────────────────
exports.plastering = async (req, res, next) => {
  try {
    const { openings_deduction_confirmed = false } = req.body;
    if (!openings_deduction_confirmed) {
      return res.status(400).json(error('Openings deduction confirmation is required for plastering.', {
        code: 'OPENINGS_DEDUCTION_REQUIRED'
      }));
    }
    const result = services.Plastering.calculate(req.body);
    await logUsage(req.user.id, 'plastering');
    return res.json(success('Plastering calculation complete', {
      ...result,
      summary: { ...result.summary, openings_deduction_confirmed: true }
    }));
  } catch (err) { next(err); }
};

// ── Paint ──────────────────────────────────────────────────────
exports.paint = async (req, res, next) => {
  try {
    const { openings_deduction_confirmed = false } = req.body;
    if (!openings_deduction_confirmed) {
      return res.status(400).json(error('Openings deduction confirmation is required for painting.', {
        code: 'OPENINGS_DEDUCTION_REQUIRED'
      }));
    }
    const result = services.Paint.calculate(req.body);
    await logUsage(req.user.id, 'paint');
    return res.json(success('Paint calculation complete', {
      ...result,
      summary: { ...result.summary, openings_deduction_confirmed: true }
    }));
  } catch (err) { next(err); }
};

// ── Roofing ───────────────────────────────────────────────────
exports.roofing = async (req, res, next) => {
  try {
    const result = services.Roofing.calculate(req.body);
    await logUsage(req.user.id, 'roofing');
    return res.json(success('Roofing calculation complete', result));
  } catch (err) { next(err); }
};

// ── Steel / Reinforcement ─────────────────────────────────────
exports.steel = async (req, res, next) => {
  try {
    const result = services.Steel.calculate(req.body);
    await logUsage(req.user.id, 'steel');
    return res.json(success('Steel reinforcement calculation complete', result));
  } catch (err) { next(err); }
};

// ── Earthwork / Excavation ────────────────────────────────────
exports.earthwork = async (req, res, next) => {
  try {
    const result = services.Earthwork.calculate(req.body);
    await logUsage(req.user.id, 'earthwork');
    return res.json(success('Earthwork calculation complete', result));
  } catch (err) { next(err); }
};

// ── Floor Tiling ──────────────────────────────────────────────
exports.tiling = async (req, res, next) => {
  try {
    const result = services.Tiling.calculate(req.body);
    await logUsage(req.user.id, 'tiling');
    return res.json(success('Tiling calculation complete', result));
  } catch (err) { next(err); }
};

// ── Save calculation ──────────────────────────────────────────
exports.save = async (req, res, next) => {
  try {
    const { calculator_type, title, inputs, outputs, project_id } = req.body;
    const { data } = await supabase
      .from('saved_calculations')
      .insert({ user_id: req.user.id, project_id, calculator_type, title, inputs, outputs })
      .select()
      .single();
    return res.status(201).json(success('Calculation saved', { calculation: data }));
  } catch (err) { next(err); }
};

exports.getSaved = async (req, res, next) => {
  try {
    const { project_id, calculator_type, limit } = req.query;
    let query = supabase.from('saved_calculations').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (project_id) query = query.eq('project_id', project_id);
    if (calculator_type) query = query.eq('calculator_type', calculator_type);
    if (limit && Number(limit) > 0) query = query.limit(Math.min(Number(limit), 100));
    const { data } = await query;
    return res.json(success('Saved calculations', { calculations: data }));
  } catch (err) { next(err); }
};

// ── Helpers ───────────────────────────────────────────────────
async function logUsage(userId, type) {
  await supabase.from('calculator_usage').insert({ user_id: userId, calculator_type: type });
}
