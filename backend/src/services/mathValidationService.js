/**
 * mathValidationService.js
 * Automated mathematical and standards validation for QSToolkit.
 * Ensures BOQ math, calculator outputs, and rates meet Nigerian QS standards.
 *
 * Implements the "Math Validation Gate" from the agent execution framework.
 */

const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────

const EPSILON = 0.01; // ₦0.01 tolerance for NGN currency

const CALCULATOR_CONSTANTS = {
  concrete: {
    dryToWetFactor: 1.54,
    cementBagYield: 0.0347, // m³ per 50kg bag
    mixRatios: {
      C20: { cement: 1, sand: 2, aggregate: 4 },
      C25: { cement: 1, sand: 1.5, aggregate: 3 },
      C30: { cement: 1, sand: 1, aggregate: 2 }
    }
  },
  blockwork: {
    '9-inch': { blocksPerM2: 10, wastageFactor: 1.05 },
    '6-inch': { blocksPerM2: 12, wastageFactor: 1.05 },
    '5-inch': { blocksPerM2: 14, wastageFactor: 1.05 }
  },
  paint: {
    emulsionCoverage: 10, // m²/litre
    wastageFactor: 1.10
  },
  tiles: {
    '600x600': { tilesPerM2: 2.78, wastageFactor: 1.05 },
    '400x400': { tilesPerM2: 6.25, wastageFactor: 1.05 }
  },
  plastering: {
    defaultThickness: 0.015, // m
    mortarFactor: 1.33,
    mixRatio: { cement: 1, sand: 4 }
  },
  steel: {
    kgPerM: {
      '8mm': 0.395,
      '10mm': 0.617,
      '12mm': 0.888,
      '16mm': 1.579,
      '20mm': 2.466,
      '25mm': 3.854,
      '32mm': 6.313
    },
    wastageFactor: 1.05
  }
};

const RATE_RANGES = {
  cement: { min: 4000, max: 8000, unit: 'bag' },
  '9-inch-blocks': { min: 250, max: 450, unit: 'block' },
  '6-inch-blocks': { min: 200, max: 350, unit: 'block' },
  'concrete-c25': { min: 35000, max: 55000, unit: 'm3' },
  plastering: { min: 1500, max: 3000, unit: 'm2' },
  'emulsion-paint': { min: 800, max: 1500, unit: 'm2' },
  'reinforcement-steel': { min: 350000, max: 550000, unit: 'tonne' }
};

// ─── BOQ Math Gate ────────────────────────────────────────────

/**
 * Validate a complete BOQ document.
 * @param {Object} boq
 * @param {Array} boq.sections
 * @param {number} boq.subtotal
 * @param {number} boq.vat
 * @param {number} boq.levy
 * @param {number} boq.total
 * @param {number} [boq.vatRate=0.075]
 * @returns {ValidationResult}
 */
function validateBoq(boq) {
  const errors = [];
  const warnings = [];

  if (!boq || !Array.isArray(boq.sections)) {
    errors.push({ type: 'STRUCTURE', message: 'BOQ must have sections array' });
    return { valid: false, errors, warnings };
  }

  let calculatedSubtotal = 0;
  const itemNumbers = new Set();

  for (const section of boq.sections) {
    if (!Array.isArray(section.items)) continue;

    for (const item of section.items) {
      // 1. Quantity > 0 for non-zero amount
      if (item.quantity <= 0 && item.amount > 0) {
        errors.push({
          type: 'QUANTITY',
          section: section.title,
          itemNo: item.item_no,
          message: `Quantity must be > 0 when amount is ${item.amount}`,
          expected: '> 0',
          actual: item.quantity
        });
      }

      // 2. Rate >= 0
      if (item.rate < 0) {
        errors.push({
          type: 'RATE',
          section: section.title,
          itemNo: item.item_no,
          message: 'Rate cannot be negative',
          expected: '>= 0',
          actual: item.rate
        });
      }

      // 3. amount == quantity * rate
      const expectedAmount = item.quantity * item.rate;
      if (Math.abs(item.amount - expectedAmount) > EPSILON) {
        errors.push({
          type: 'MATH',
          section: section.title,
          itemNo: item.item_no,
          message: `amount (${item.amount}) ≠ quantity (${item.quantity}) × rate (${item.rate}) = ${expectedAmount.toFixed(2)}`,
          expected: expectedAmount.toFixed(2),
          actual: item.amount,
          suggestedFix: { ...item, amount: Math.round(expectedAmount * 100) / 100 }
        });
      }

      // 4. No duplicate item numbers
      if (item.item_no) {
        if (itemNumbers.has(item.item_no)) {
          errors.push({
            type: 'DUPLICATE',
            section: section.title,
            itemNo: item.item_no,
            message: `Duplicate item number: ${item.item_no}`
          });
        }
        itemNumbers.add(item.item_no);
      }

      calculatedSubtotal += item.amount || 0;

      // Rate reasonableness check
      const rateCheck = checkRateReasonableness(item.description, item.rate, item.unit);
      if (rateCheck.flag) {
        warnings.push({
          type: 'RATE_RANGE',
          section: section.title,
          itemNo: item.item_no,
          message: rateCheck.message,
          expected: rateCheck.expected
        });
      }
    }
  }

  // 5. subtotal == sum(item.amount)
  if (Math.abs((boq.subtotal || 0) - calculatedSubtotal) > EPSILON) {
    errors.push({
      type: 'SUBTOTAL',
      message: `Subtotal (${boq.subtotal}) ≠ sum of item amounts (${calculatedSubtotal.toFixed(2)})`,
      expected: calculatedSubtotal.toFixed(2),
      actual: boq.subtotal
    });
  }

  // 6. total == subtotal + vat + levy
  const vatRate = boq.vatRate || 0.075;
  const expectedVat = (boq.subtotal || 0) * vatRate;
  const expectedTotal = (boq.subtotal || 0) + expectedVat + (boq.levy || 0);

  if (Math.abs((boq.vat || 0) - expectedVat) > EPSILON) {
    errors.push({
      type: 'VAT',
      message: `VAT (${boq.vat}) ≠ subtotal (${boq.subtotal}) × ${vatRate} = ${expectedVat.toFixed(2)}`,
      expected: expectedVat.toFixed(2),
      actual: boq.vat
    });
  }

  if (Math.abs((boq.total || 0) - expectedTotal) > EPSILON) {
    errors.push({
      type: 'TOTAL',
      message: `Total (${boq.total}) ≠ subtotal + VAT + levy = ${expectedTotal.toFixed(2)}`,
      expected: expectedTotal.toFixed(2),
      actual: boq.total
    });
  }

  const valid = errors.length === 0;

  if (!valid) {
    logger.warn('BOQ validation failed', { errorCount: errors.length, warningCount: warnings.length });
  }

  return { valid, errors, warnings };
}

// ─── Calculator Validation ────────────────────────────────────

/**
 * Validate calculator output against Nigerian QS standards.
 * @param {string} calculatorType - e.g., 'concrete', 'blockwork', 'paint', 'plastering', 'steel'
 * @param {Object} inputs - Calculator inputs
 * @param {Object} outputs - Calculator outputs
 * @returns {ValidationResult}
 */
function validateCalculator(calculatorType, inputs, outputs) {
  const errors = [];
  const warnings = [];

  switch (calculatorType) {
    case 'concrete':
      validateConcreteCalculator(inputs, outputs, errors, warnings);
      break;
    case 'blockwork':
      validateBlockworkCalculator(inputs, outputs, errors, warnings);
      break;
    case 'paint':
      validatePaintCalculator(inputs, outputs, errors, warnings);
      break;
    case 'plastering':
      validatePlasteringCalculator(inputs, outputs, errors, warnings);
      break;
    case 'steel':
      validateSteelCalculator(inputs, outputs, errors, warnings);
      break;
    default:
      warnings.push({ type: 'UNKNOWN', message: `Unknown calculator type: ${calculatorType}` });
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateConcreteCalculator(inputs, outputs, errors, warnings) {
  const volume = inputs.volume_m3 || inputs.wetVolume || 0;
  const dryVolume = volume * CALCULATOR_CONSTANTS.concrete.dryToWetFactor;
  const expectedCementBags = Math.ceil(dryVolume / CALCULATOR_CONSTANTS.concrete.cementBagYield);

  if (outputs.cementBags && Math.abs(outputs.cementBags - expectedCementBags) > 1) {
    errors.push({
      type: 'CONCRETE_CEMENT',
      message: `Cement bags (${outputs.cementBags}) deviates from expected (${expectedCementBags})`,
      expected: expectedCementBags,
      actual: outputs.cementBags
    });
  }
}

function validateBlockworkCalculator(inputs, outputs, errors, warnings) {
  const blockType = inputs.blockType || '9-inch';
  const area = inputs.area_m2 || 0;
  const config = CALCULATOR_CONSTANTS.blockwork[blockType];

  if (!config) {
    warnings.push({ type: 'BLOCK_TYPE', message: `Unknown block type: ${blockType}` });
    return;
  }

  const expectedBlocks = Math.ceil(area * config.blocksPerM2 * config.wastageFactor);

  if (outputs.blocks && Math.abs(outputs.blocks - expectedBlocks) > 5) {
    errors.push({
      type: 'BLOCKWORK',
      message: `Block count (${outputs.blocks}) deviates from expected (${expectedBlocks})`,
      expected: expectedBlocks,
      actual: outputs.blocks
    });
  }
}

function validatePaintCalculator(inputs, outputs, errors, warnings) {
  const area = inputs.area_m2 || 0;
  const paintType = inputs.paintType || 'emulsion';
  const coverage = CALCULATOR_CONSTANTS.paint.emulsionCoverage;
  const expectedLitres = Math.ceil((area / coverage) * CALCULATOR_CONSTANTS.paint.wastageFactor);

  if (outputs.litres && Math.abs(outputs.litres - expectedLitres) > 0.5) {
    errors.push({
      type: 'PAINT',
      message: `Paint litres (${outputs.litres}) deviates from expected (${expectedLitres})`,
      expected: expectedLitres,
      actual: outputs.litres
    });
  }
}

function validatePlasteringCalculator(inputs, outputs, errors, warnings) {
  const area = inputs.area_m2 || 0;
  const thickness = inputs.thickness_m || CALCULATOR_CONSTANTS.plastering.defaultThickness;
  const volume = area * thickness * CALCULATOR_CONSTANTS.plastering.mortarFactor;
  const expectedCementBags = Math.ceil((volume * CALCULATOR_CONSTANTS.concrete.dryToWetFactor) / CALCULATOR_CONSTANTS.concrete.cementBagYield);

  if (outputs.cementBags && Math.abs(outputs.cementBags - expectedCementBags) > 1) {
    errors.push({
      type: 'PLASTERING',
      message: `Cement bags (${outputs.cementBags}) deviates from expected (${expectedCementBags})`,
      expected: expectedCementBags,
      actual: outputs.cementBags
    });
  }
}

function validateSteelCalculator(inputs, outputs, errors, warnings) {
  const barSize = inputs.barSize || '12mm';
  const length = inputs.length_m || 0;
  const kgPerM = CALCULATOR_CONSTANTS.steel.kgPerM[barSize];

  if (!kgPerM) {
    warnings.push({ type: 'BAR_SIZE', message: `Unknown bar size: ${barSize}` });
    return;
  }

  const expectedWeight = length * kgPerM * CALCULATOR_CONSTANTS.steel.wastageFactor;

  if (outputs.weightKg && Math.abs(outputs.weightKg - expectedWeight) > 1) {
    errors.push({
      type: 'STEEL',
      message: `Steel weight (${outputs.weightKg}kg) deviates from expected (${expectedWeight.toFixed(2)}kg)`,
      expected: expectedWeight.toFixed(2),
      actual: outputs.weightKg
    });
  }
}

// ─── Rate Reasonableness ──────────────────────────────────────

function checkRateReasonableness(description, rate, unit) {
  if (!rate || rate <= 0) return { flag: false };

  const desc = (description || '').toLowerCase();

  for (const [key, range] of Object.entries(RATE_RANGES)) {
    const keywords = key.split('-');
    const matches = keywords.some((kw) => desc.includes(kw));
    if (matches) {
      if (rate < range.min || rate > range.max) {
        return {
          flag: true,
          message: `Rate ₦${rate.toLocaleString()}/${unit} is outside typical Nigerian range (₦${range.min.toLocaleString()}–₦${range.max.toLocaleString()})`,
          expected: `₦${range.min.toLocaleString()}–₦${range.max.toLocaleString()}`
        };
      }
      return { flag: false };
    }
  }

  return { flag: false };
}

// ─── Cross-Document Consistency ───────────────────────────────

/**
 * Validate consistency between BOQ and Invoice.
 * @param {Object} boq
 * @param {Object} invoice
 * @returns {ValidationResult}
 */
function validateBoqInvoiceConsistency(boq, invoice) {
  const errors = [];
  const warnings = [];

  if (!boq || !invoice) {
    errors.push({ type: 'MISSING', message: 'Both BOQ and invoice required' });
    return { valid: false, errors, warnings };
  }

  // Invoice total should reflect BOQ subtotal + adjustments
  const invoiceTotal = (invoice.subtotal || 0) + (invoice.vat || 0) + (invoice.levy || 0);
  if (Math.abs((invoice.total || 0) - invoiceTotal) > EPSILON) {
    errors.push({
      type: 'INVOICE_TOTAL',
      message: `Invoice total mismatch: ${invoice.total} ≠ ${invoiceTotal.toFixed(2)}`,
      expected: invoiceTotal.toFixed(2),
      actual: invoice.total
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Types (JSDoc) ────────────────────────────────────────────

/**
 * @typedef {Object} ValidationError
 * @property {string} type - Error category
 * @property {string} [section] - Affected BOQ section
 * @property {string} [itemNo] - Affected item number
 * @property {string} message - Human-readable error
 * @property {string|number} [expected] - Expected value
 * @property {string|number} [actual] - Actual value
 * @property {Object} [suggestedFix] - Auto-correction
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {ValidationError[]} errors - Blocking errors
 * @property {ValidationError[]} warnings - Non-blocking warnings
 */

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  validateBoq,
  validateCalculator,
  validateBoqInvoiceConsistency,
  CALCULATOR_CONSTANTS,
  RATE_RANGES,
  EPSILON
};
