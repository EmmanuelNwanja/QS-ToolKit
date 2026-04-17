const ALLOWED_STANDARDS = ['SMM7', 'NRM2'];

function normalizeStandard(input) {
  const value = String(input || '').trim().toUpperCase();
  return ALLOWED_STANDARDS.includes(value) ? value : null;
}

function hasMeaningfulOpeningDeductions(item) {
  const text = String(item?.remarks || '').toLowerCase();
  return text.includes('opening deduction') || text.includes('openings deducted');
}

function validateItemSpecDepth(item) {
  const description = String(item?.description || '').toLowerCase();
  const targetKeywords = ['window', 'door', 'plaster', 'render', 'painting', 'paint'];
  const needsSpecDepth = targetKeywords.some((k) => description.includes(k));

  if (!needsSpecDepth) return [];

  const issues = [];
  if (!item?.material_type) issues.push('material_type is required');
  if (!item?.thickness_or_mix) issues.push('thickness_or_mix is required');
  if (!item?.finish_type) issues.push('finish_type is required');
  return issues;
}

function validateBoqForFinalization(boq) {
  const errors = [];
  const warnings = [];
  const standard = normalizeStandard(boq?.measurement_standard);

  if (!standard) {
    errors.push('Measurement standard must be set to SMM7 or NRM2.');
  }

  const sections = Array.isArray(boq?.boq_sections) ? boq.boq_sections : [];
  const prelimSection = sections.find((s) => s.section_type === 'preliminaries');

  if (!prelimSection) {
    errors.push('A preliminaries section is required before finalization.');
  } else if (!Array.isArray(prelimSection.boq_items) || prelimSection.boq_items.length === 0) {
    errors.push('Preliminaries section must contain at least one item.');
  }

  sections.forEach((section) => {
    (section.boq_items || []).forEach((item) => {
      const specDepthIssues = validateItemSpecDepth(item);
      if (specDepthIssues.length > 0) {
        errors.push(
          `Item "${item.item_no || item.description || item.id}" is missing specification details: ${specDepthIssues.join(', ')}.`
        );
      }

      const itemDescription = String(item.description || '').toLowerCase();
      const isSurfaceItem = itemDescription.includes('paint') || itemDescription.includes('plaster') || itemDescription.includes('render');
      if (isSurfaceItem && !hasMeaningfulOpeningDeductions(item)) {
        warnings.push(
          `Item "${item.item_no || item.description || item.id}" has no explicit openings deduction note in remarks.`
        );
      }
    });
  });

  return {
    ok: errors.length === 0,
    standard,
    errors,
    warnings
  };
}

module.exports = {
  ALLOWED_STANDARDS,
  normalizeStandard,
  validateBoqForFinalization
};
