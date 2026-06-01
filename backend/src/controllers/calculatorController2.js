const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const { services } = require('../../modules/calculators');

// ================================================================
//  NEW QS Calculators — delegates to modules/calculators/services
// ================================================================

// ── CALCULATOR 1: Carpentry & Roof Timbers ────────────────────────
exports.carpentry = async (req, res, next) => {
  try {
    const result = services.Carpentry.calculate(req.body);
    await logUsage(req.user.id, 'carpentry');
    return res.json(success('Carpentry & Timber calculation complete', result));
  } catch (err) { next(err); }
};


// ── CALCULATOR 2: Formwork ───────────────────────────────────────
exports.formwork = async (req, res, next) => {
  try {
    const result = services.Formwork.calculate(req.body);
    await logUsage(req.user.id, 'formwork');
    return res.json(success('Formwork calculation complete', result));
  } catch (err) { next(err); }
};


// ── CALCULATOR 3: Roof Accessories ──────────────────────────────
exports.roofAccessories = async (req, res, next) => {
  try {
    const result = services.RoofAccessories.calculate(req.body);
    await logUsage(req.user.id, 'roof_accessories');
    return res.json(success('Roof Accessories calculation complete', result));
  } catch (err) { next(err); }
};


// ── CALCULATOR 4: Door & Window Schedule ─────────────────────────
exports.doorWindow = async (req, res, next) => {
  try {
    const result = services.DoorWindow.calculate(req.body);
    await logUsage(req.user.id, 'door_window');
    return res.json(success('Door & Window Schedule complete', result));
  } catch (err) { next(err); }
};


// ── CALCULATOR 5: BRC Mesh / DPM & Surface Treatments ────────────
exports.brcDpm = async (req, res, next) => {
  try {
    const result = services.BrcDpm.calculate(req.body);
    await logUsage(req.user.id, 'brc_dpm');
    return res.json(success('BRC Mesh / DPM calculation complete', result));
  } catch (err) { next(err); }
};

// ── Helper ────────────────────────────────────────────────────────
async function logUsage(userId, type) {
  await supabase.from('calculator_usage').insert({ user_id: userId, calculator_type: type });
}
