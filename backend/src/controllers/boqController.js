const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');

// ─── List BOQs ────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    let query = supabase
      .from('boq_documents')
      .select('*, projects(title, client_name)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (project_id) query = query.eq('project_id', project_id);

    const { data, error: err } = await query;
    if (err) throw err;
    return res.json(success('BOQ documents', { boqs: data }));
  } catch (err) { next(err); }
};

// ─── Create BOQ ───────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { sections = [] } = req.body;

    // Allow only known BOQ document columns to avoid schema-cache errors
    // when the client sends extra UI-only fields.
    const boqData = {
      project_id: req.body.project_id,
      title: req.body.title,
      notes: req.body.notes,
      contract_no: req.body.contract_no,
      client_name: req.body.client_name,
      location: req.body.location,
      prepared_by: req.body.prepared_by,
      checked_by: req.body.checked_by,
      date_prepared: req.body.date_prepared,
      status: req.body.status
    };

    const { data: boq, error: boqErr } = await supabase
      .from('boq_documents')
      .insert({ ...boqData, user_id: req.user.id })
      .select()
      .single();

    if (boqErr) throw boqErr;

    // Insert sections and items
    for (const [i, section] of sections.entries()) {
      const { items = [], ...sectionData } = section;
      const { data: sec } = await supabase
        .from('boq_sections')
        .insert({ ...sectionData, boq_id: boq.id, sort_order: i })
        .select()
        .single();

      if (items.length > 0) {
        await supabase.from('boq_items').insert(
          items.map((item, j) => ({ ...item, section_id: sec.id, boq_id: boq.id, sort_order: j }))
        );
      }
    }

    const fullBoq = await getFullBoq(boq.id, req.user.id);
    return res.status(201).json(success('BOQ created', { boq: fullBoq }));
  } catch (err) { next(err); }
};

// ─── Get single BOQ ───────────────────────────────────────────
exports.get = async (req, res, next) => {
  try {
    const boq = await getFullBoq(req.params.id, req.user.id);
    if (!boq) return res.status(404).json(error('BOQ not found'));
    return res.json(success('BOQ details', { boq }));
  } catch (err) { next(err); }
};

// ─── Update BOQ ───────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const updatePayload = {
      project_id: req.body.project_id,
      title: req.body.title,
      notes: req.body.notes,
      contract_no: req.body.contract_no,
      client_name: req.body.client_name,
      location: req.body.location,
      prepared_by: req.body.prepared_by,
      checked_by: req.body.checked_by,
      date_prepared: req.body.date_prepared,
      status: req.body.status,
      updated_at: new Date()
    };

    // Remove undefined keys to avoid overwriting columns unintentionally.
    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) delete updatePayload[key];
    });

    const { data, error: err } = await supabase
      .from('boq_documents')
      .update(updatePayload)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (err || !data) return res.status(404).json(error('BOQ not found'));
    return res.json(success('BOQ updated', { boq: data }));
  } catch (err) { next(err); }
};

// ─── Delete BOQ ───────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    await supabase.from('boq_documents').delete()
      .eq('id', req.params.id).eq('user_id', req.user.id);
    return res.json(success('BOQ deleted'));
  } catch (err) { next(err); }
};

// ─── Add Section ──────────────────────────────────────────────
exports.addSection = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('boq_sections')
      .insert({ ...req.body, boq_id: req.params.id })
      .select()
      .single();

    if (err) throw err;
    return res.status(201).json(success('Section added', { section: data }));
  } catch (err) { next(err); }
};

// ─── Add Item to Section ──────────────────────────────────────
exports.addItem = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('boq_items')
      .insert({ ...req.body, boq_id: req.params.id, section_id: req.params.sectionId })
      .select()
      .single();

    if (err) throw err;

    // Recalculate section total
    await recalcTotals(req.params.id);

    return res.status(201).json(success('Item added', { item: data }));
  } catch (err) { next(err); }
};

// ─── Update Item ──────────────────────────────────────────────
exports.updateItem = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('boq_items')
      .update(req.body)
      .eq('id', req.params.itemId)
      .select()
      .single();

    if (err) throw err;
    await recalcTotals(req.params.id);
    return res.json(success('Item updated', { item: data }));
  } catch (err) { next(err); }
};

// ─── Delete Item ──────────────────────────────────────────────
exports.removeItem = async (req, res, next) => {
  try {
    await supabase.from('boq_items').delete().eq('id', req.params.itemId);
    await recalcTotals(req.params.id);
    return res.json(success('Item deleted'));
  } catch (err) { next(err); }
};

// ─── Export PDF ───────────────────────────────────────────────
exports.exportPdf = async (req, res, next) => {
  try {
    const boq = await getFullBoq(req.params.id, req.user.id);
    if (!boq) return res.status(404).json(error('BOQ not found'));

    const { data: branding } = await supabase
      .from('branding_settings').select('*').eq('user_id', req.user.id).single();

    const pdfBuffer = await pdfService.generateBoqPdf(boq, branding);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BOQ-${boq.id.slice(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (pdfService.isPdfUnavailableError?.(err)) {
      return res.status(503).json(error('BOQ PDF export is temporarily unavailable. Please retry later.', {
        code: 'PDF_UNAVAILABLE',
        details: err.details || null
      }));
    }
    next(err);
  }
};

// ─── Export Excel ─────────────────────────────────────────────
exports.exportExcel = async (req, res, next) => {
  try {
    const boq = await getFullBoq(req.params.id, req.user.id);
    if (!boq) return res.status(404).json(error('BOQ not found'));

    const { data: branding } = await supabase
      .from('branding_settings').select('*').eq('user_id', req.user.id).single();

    const buffer = await excelService.generateBoqExcel(boq, branding);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BOQ-${boq.id.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

// ─── Helpers ──────────────────────────────────────────────────
async function getFullBoq(boqId, userId) {
  const { data } = await supabase
    .from('boq_documents')
    .select(`
      *,
      projects(title, client_name, location),
      boq_sections(
        *,
        boq_items(* )
      )
    `)
    .eq('id', boqId)
    .eq('user_id', userId)
    .single();

  return data;
}

async function recalcTotals(boqId) {
  const { data: items } = await supabase
    .from('boq_items')
    .select('section_id, amount')
    .eq('boq_id', boqId);

  // Group by section
  const sectionTotals = {};
  items?.forEach(item => {
    sectionTotals[item.section_id] = (sectionTotals[item.section_id] || 0) + (item.amount || 0);
  });

  // Update each section total
  for (const [sectionId, total] of Object.entries(sectionTotals)) {
    await supabase.from('boq_sections').update({ section_total: total }).eq('id', sectionId);
  }

  // Update boq total
  const grandTotal = Object.values(sectionTotals).reduce((s, v) => s + v, 0);
  await supabase.from('boq_documents').update({ total_amount: grandTotal }).eq('id', boqId);
}
