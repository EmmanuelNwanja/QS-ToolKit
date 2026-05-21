const supabase = require('../config/supabase');
const aiService = require('../services/aiService');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Create a revision snapshot when a BOQ is finalized.
 */
exports.createRevision = async (boqId, userId) => {
  try {
    const { data: boq } = await supabase
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
      .single();

    if (!boq) return { error: true, message: 'BOQ not found' };

    // Get next revision number
    const { data: lastRev } = await supabase
      .from('boq_revisions')
      .select('revision_number')
      .eq('boq_id', boqId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (lastRev?.revision_number || 0) + 1;

    const { data, error: err } = await supabase
      .from('boq_revisions')
      .insert({
        boq_id: boqId,
        user_id: userId,
        revision_number: nextNumber,
        snapshot: boq
      })
      .select()
      .single();

    if (err) throw err;
    return { error: false, revision: data };
  } catch (err) {
    logger.error('Create revision error:', err.message);
    return { error: true, message: err.message };
  }
};

// ─── List Revisions ───────────────────────────────────────────
exports.listRevisions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error: err } = await supabase
      .from('boq_revisions')
      .select('id, revision_number, change_summary, created_at')
      .eq('boq_id', id)
      .eq('user_id', req.user.id)
      .order('revision_number', { ascending: true });

    if (err) throw err;
    return res.json(success('BOQ revisions', { revisions: data }));
  } catch (err) { next(err); }
};

// ─── Get Single Revision ──────────────────────────────────────
exports.getRevision = async (req, res, next) => {
  try {
    const { id, revId } = req.params;
    const { data, error: err } = await supabase
      .from('boq_revisions')
      .select('*')
      .eq('id', revId)
      .eq('boq_id', id)
      .eq('user_id', req.user.id)
      .single();

    if (err || !data) return res.status(404).json(error('Revision not found'));
    return res.json(success('Revision details', { revision: data }));
  } catch (err) { next(err); }
};

// ─── Compare Two Revisions ────────────────────────────────────
exports.compareRevisions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rev_a, rev_b } = req.query;

    if (!rev_a || !rev_b) {
      return res.status(400).json(error('rev_a and rev_b query params required'));
    }

    const { data: revA } = await supabase
      .from('boq_revisions')
      .select('snapshot, revision_number, created_at')
      .eq('id', rev_a)
      .eq('boq_id', id)
      .eq('user_id', req.user.id)
      .single();

    const { data: revB } = await supabase
      .from('boq_revisions')
      .select('snapshot, revision_number, created_at')
      .eq('id', rev_b)
      .eq('boq_id', id)
      .eq('user_id', req.user.id)
      .single();

    if (!revA || !revB) return res.status(404).json(error('One or both revisions not found'));

    // Structured diff
    const diff = computeStructuredDiff(revA.snapshot, revB.snapshot);

    // Optional AI summary
    let aiSummary = null;
    try {
      aiSummary = await aiService.summarizeVariance(revA.snapshot, revB.snapshot);
    } catch (e) {
      logger.warn('AI variance summary failed, using structured diff only');
    }

    return res.json(success('Variance comparison', {
      revision_a: { number: revA.revision_number, created_at: revA.created_at },
      revision_b: { number: revB.revision_number, created_at: revB.created_at },
      diff,
      ai_summary: aiSummary
    }));
  } catch (err) {
    logger.error('Compare revisions error:', err.message);
    next(err);
  }
};

// ─── Structured Diff Algorithm ────────────────────────────────
function computeStructuredDiff(oldBoq, newBoq) {
  const changes = [];

  // Document-level changes
  const docFields = ['title', 'client_name', 'location', 'contract_no', 'total_amount', 'status'];
  for (const field of docFields) {
    if (oldBoq[field] !== newBoq[field]) {
      changes.push({
        type: 'modified',
        level: 'document',
        field,
        before: oldBoq[field],
        after: newBoq[field]
      });
    }
  }

  // Section-level changes
  const oldSections = oldBoq.boq_sections || [];
  const newSections = newBoq.boq_sections || [];

  const oldSectionMap = new Map(oldSections.map((s) => [s.id, s]));
  const newSectionMap = new Map(newSections.map((s) => [s.id, s]));

  // Added sections
  for (const [id, section] of newSectionMap) {
    if (!oldSectionMap.has(id)) {
      changes.push({ type: 'added', level: 'section', section_title: section.title, items: section.boq_items?.length || 0 });
    }
  }

  // Removed sections
  for (const [id, section] of oldSectionMap) {
    if (!newSectionMap.has(id)) {
      changes.push({ type: 'removed', level: 'section', section_title: section.title, items: section.boq_items?.length || 0 });
    }
  }

  // Modified sections: compare items
  for (const [id, oldSec] of oldSectionMap) {
    const newSec = newSectionMap.get(id);
    if (!newSec) continue;

    const oldItems = oldSec.boq_items || [];
    const newItems = newSec.boq_items || [];
    const oldItemMap = new Map(oldItems.map((i) => [i.id, i]));
    const newItemMap = new Map(newItems.map((i) => [i.id, i]));

    for (const [itemId, oldItem] of oldItemMap) {
      const newItem = newItemMap.get(itemId);
      if (!newItem) {
        changes.push({
          type: 'removed',
          level: 'item',
          section_title: oldSec.title,
          item_no: oldItem.item_no,
          description: oldItem.description
        });
        continue;
      }

      const itemFields = ['description', 'unit', 'quantity', 'rate', 'amount'];
      const itemChanges = {};
      for (const f of itemFields) {
        if (oldItem[f] !== newItem[f]) itemChanges[f] = { before: oldItem[f], after: newItem[f] };
      }

      if (Object.keys(itemChanges).length > 0) {
        changes.push({
          type: 'modified',
          level: 'item',
          section_title: oldSec.title,
          item_no: oldItem.item_no,
          description: oldItem.description,
          changes: itemChanges
        });
      }
    }

    for (const [itemId, newItem] of newItemMap) {
      if (!oldItemMap.has(itemId)) {
        changes.push({
          type: 'added',
          level: 'item',
          section_title: newSec.title,
          item_no: newItem.item_no,
          description: newItem.description,
          quantity: newItem.quantity,
          rate: newItem.rate
        });
      }
    }
  }

  // Summary stats
  const summary = {
    total_changes: changes.length,
    document_changes: changes.filter((c) => c.level === 'document').length,
    sections_added: changes.filter((c) => c.level === 'section' && c.type === 'added').length,
    sections_removed: changes.filter((c) => c.level === 'section' && c.type === 'removed').length,
    items_added: changes.filter((c) => c.level === 'item' && c.type === 'added').length,
    items_removed: changes.filter((c) => c.level === 'item' && c.type === 'removed').length,
    items_modified: changes.filter((c) => c.level === 'item' && c.type === 'modified').length,
    old_total: Number(oldBoq.total_amount) || 0,
    new_total: Number(newBoq.total_amount) || 0,
    total_difference: (Number(newBoq.total_amount) || 0) - (Number(oldBoq.total_amount) || 0)
  };

  return { summary, changes };
}
