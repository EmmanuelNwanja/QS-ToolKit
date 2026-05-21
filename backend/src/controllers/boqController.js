const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');
const { singleOrNull } = require('../utils/supabaseQuery');
const { normalizeStandard, validateBoqForFinalization } = require('../services/measurementStandardService');
const boqRevisionController = require('./boqRevisionController');

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
    const standard = normalizeStandard(req.body.measurement_standard);
    if (!standard) {
      return res.status(400).json(error('Measurement standard is required (SMM7 or NRM2).', {
        code: 'MEASUREMENT_STANDARD_REQUIRED'
      }));
    }

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
      date_prepared: req.body.date_prepared ? req.body.date_prepared : undefined, // Empty string becomes undefined (uses default)
      status: req.body.status,
      measurement_standard: standard
    };

    // Remove undefined keys to let DB use defaults
    Object.keys(boqData).forEach(key => boqData[key] === undefined && delete boqData[key]);

    const { data: boq, error: boqErr } = await supabase
      .from('boq_documents')
      .insert({ ...boqData, user_id: req.user.id })
      .select()
      .single();

    if (boqErr) throw boqErr;

    const normalizedSections = normalizeSections(sections);

    // Insert sections and items
    for (const [i, section] of normalizedSections.entries()) {
      const { items = [], ...sectionData } = section;
      const { data: sec } = await supabase
        .from('boq_sections')
        .insert({ ...sectionData, boq_id: boq.id, sort_order: i })
        .select()
        .single();

      if (items.length > 0) {
        await supabase.from('boq_items').insert(
          items.map((item, j) => ({
            ...normalizeItem(item),
            section_id: sec.id,
            boq_id: boq.id,
            sort_order: j,
            is_preliminary: sectionData.section_type === 'preliminaries'
          }))
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
    if (!boq) return res.status(404).json(error('BOQ not found', { code: 'BOQ_NOT_FOUND' }));
    return res.json(success('BOQ details', { boq }));
  } catch (err) { next(err); }
};

// ─── Update BOQ ───────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const standard = req.body.measurement_standard !== undefined
      ? normalizeStandard(req.body.measurement_standard)
      : undefined;
    if (req.body.measurement_standard !== undefined && !standard) {
      return res.status(400).json(error('Measurement standard must be SMM7 or NRM2.', {
        code: 'MEASUREMENT_STANDARD_INVALID'
      }));
    }

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
      measurement_standard: standard,
      updated_at: new Date()
    };

    // Sanitize empty date strings to null, then remove undefined/null keys
    if (updatePayload.date_prepared === '' || updatePayload.date_prepared === null) {
      delete updatePayload.date_prepared; // Remove to avoid overwriting with null
    }

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

    if (err || !data) return res.status(404).json(error('BOQ not found', { code: 'BOQ_NOT_FOUND' }));

    if (data.status === 'final' || data.status === 'submitted') {
      const fullBoq = await getFullBoq(req.params.id, req.user.id);
      const validation = validateBoqForFinalization(fullBoq);
      if (!validation.ok) {
        return res.status(422).json(error('BOQ compliance checks failed.', {
          code: 'BOQ_COMPLIANCE_FAILED',
          errors: validation.errors
        }));
      }
      // Auto-create revision snapshot for variance detection
      await boqRevisionController.createRevision(req.params.id, req.user.id);
    }

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
    const sectionPayload = {
      ...req.body,
      section_type: normalizeSectionType(req.body.section_type)
    };
    const { data, error: err } = await supabase
      .from('boq_sections')
      .insert({ ...sectionPayload, boq_id: req.params.id })
      .select()
      .single();

    if (err) throw err;
    return res.status(201).json(success('Section added', { section: data }));
  } catch (err) { next(err); }
};

// ─── Add Item to Section ──────────────────────────────────────
exports.addItem = async (req, res, next) => {
  try {
    const normalized = normalizeItem(req.body);
    const { data, error: err } = await supabase
      .from('boq_items')
      .insert({ ...normalized, boq_id: req.params.id, section_id: req.params.sectionId })
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
    const updatePayload = normalizeItem(req.body, true);
    const { data, error: err } = await supabase
      .from('boq_items')
      .update(updatePayload)
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
    if (!boq) return res.status(404).json(error('BOQ not found', { code: 'BOQ_NOT_FOUND' }));

    const validation = validateBoqForFinalization(boq);
    if (!validation.ok) {
      return res.status(422).json(error('BOQ compliance checks failed. Export blocked.', {
        code: 'BOQ_COMPLIANCE_FAILED',
        errors: validation.errors
      }));
    }

    const branding = await getBrandingForUser(req.user.id);

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
    if (!boq) return res.status(404).json(error('BOQ not found', { code: 'BOQ_NOT_FOUND' }));

    const validation = validateBoqForFinalization(boq);
    if (!validation.ok) {
      return res.status(422).json(error('BOQ compliance checks failed. Export blocked.', {
        code: 'BOQ_COMPLIANCE_FAILED',
        errors: validation.errors
      }));
    }

    const branding = await getBrandingForUser(req.user.id);

    const buffer = await excelService.generateBoqExcel(boq, branding);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BOQ-${boq.id.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

// ─── Helpers ──────────────────────────────────────────────────
async function getFullBoq(boqId, userId) {
  const boq = await singleOrNull(
    supabase
    .from('boq_documents')
    .select(`
      *,
      boq_sections(
        *,
        boq_items(*)
      )
    `)
    .eq('id', boqId)
    .eq('user_id', userId)
  );

  if (!boq) return null;

  // Fetch project separately if project_id exists
  if (boq.project_id) {
    const project = await singleOrNull(
      supabase
        .from('projects')
        .select('id, title, client_name, location')
        .eq('id', boq.project_id)
    );
    boq.projects = project || null;
  } else {
    boq.projects = null;
  }

  return boq;
}

async function getBrandingForUser(userId) {
  return singleOrNull(
    supabase
    .from('branding_settings')
    .select('*')
    .eq('user_id', userId)
  );
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

function normalizeSectionType(sectionType) {
  const value = String(sectionType || 'measured_work').trim().toLowerCase();
  const allowed = ['preliminaries', 'measured_work', 'provisional_sum', 'dayworks'];
  return allowed.includes(value) ? value : 'measured_work';
}

function normalizeSections(sections = []) {
  const next = sections.map((section, index) => ({
    ...section,
    sort_order: section.sort_order ?? index,
    section_type: normalizeSectionType(section.section_type)
  }));

  const hasPrelim = next.some((s) => s.section_type === 'preliminaries');
  if (!hasPrelim) {
    next.unshift({
      title: 'Preliminaries',
      section_type: 'preliminaries',
      sort_order: 0,
      items: [{
        item_no: 'P1',
        description: 'Site setup and mobilization',
        unit: 'item',
        quantity: 1,
        rate: 0,
        amount: 0,
        cost_class: 'preliminaries',
        is_preliminary: true
      }]
    });
  }

  return next.map((section, index) => ({ ...section, sort_order: index }));
}

function normalizeItem(input = {}, partial = false) {
  const normalized = {};
  const keys = [
    'item_no', 'description', 'unit', 'quantity', 'rate', 'remarks',
    'material_type', 'thickness_or_mix', 'finish_type', 'spec_reference',
    'cost_class', 'is_preliminary'
  ];

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) normalized[key] = input[key];
  });

  if (!partial || normalized.cost_class !== undefined) {
    const rawCostClass = String(normalized.cost_class || 'measured_work').trim().toLowerCase();
    const allowed = ['preliminaries', 'measured_work', 'provisional_sum', 'dayworks'];
    normalized.cost_class = allowed.includes(rawCostClass) ? rawCostClass : 'measured_work';
  }

  if (!partial || normalized.is_preliminary !== undefined) {
    normalized.is_preliminary = Boolean(normalized.is_preliminary || normalized.cost_class === 'preliminaries');
  }

  return normalized;
}
