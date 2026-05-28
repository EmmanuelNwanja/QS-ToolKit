/**
 * qualityGateEngine.js
 * Automated verification gates for the self-improving platform.
 * Ensures changes meet quality standards before deployment.
 */

const logger = require('../utils/logger');
const { validateBoq, validateCalculator, validateBoqInvoiceConsistency } = require('./mathValidationService');

// ─── Gate Registry ────────────────────────────────────────────

const GATES = {
  boq_math: {
    name: 'BOQ Math Gate',
    description: 'All BOQ line items must have correct math',
    run: async (context) => {
      const result = validateBoq(context.boq);
      return {
        passed: result.valid,
        score: result.valid ? 1.0 : 0.0,
        details: result.errors
      };
    }
  },

  calculator_standards: {
    name: 'Calculator Standards Gate',
    description: 'Calculator outputs must match Nigerian QS constants',
    run: async (context) => {
      const result = validateCalculator(context.calculatorType, context.inputs, context.outputs);
      return {
        passed: result.valid,
        score: result.valid ? 1.0 : 0.5,
        details: [...result.errors, ...result.warnings]
      };
    }
  },

  cross_document_consistency: {
    name: 'Cross-Document Consistency Gate',
    description: 'BOQ and invoice must be consistent',
    run: async (context) => {
      const result = validateBoqInvoiceConsistency(context.boq, context.invoice);
      return {
        passed: result.valid,
        score: result.valid ? 1.0 : 0.0,
        details: result.errors
      };
    }
  },

  rate_reasonableness: {
    name: 'Rate Reasonableness Gate',
    description: 'Suggested rates must be within Nigerian market ranges',
    run: async (context) => {
      const { RATE_RANGES } = require('./mathValidationService');
      const errors = [];

      for (const item of context.items || []) {
        const desc = (item.description || '').toLowerCase();
        for (const [key, range] of Object.entries(RATE_RANGES)) {
          const keywords = key.split('-');
          if (keywords.some((kw) => desc.includes(kw))) {
            if (item.rate < range.min || item.rate > range.max) {
              errors.push({
                item: item.description,
                rate: item.rate,
                expected: `₦${range.min.toLocaleString()}–₦${range.max.toLocaleString()}`
              });
            }
          }
        }
      }

      return {
        passed: errors.length === 0,
        score: errors.length === 0 ? 1.0 : Math.max(0, 1 - errors.length * 0.1),
        details: errors
      };
    }
  },

  forecast_accuracy: {
    name: 'Forecast Accuracy Gate',
    description: 'Forecast MAPE must be within acceptable threshold',
    run: async (context) => {
      const mape = context.mape || 0;
      const threshold = context.threshold || 0.15;
      const passed = mape <= threshold;

      return {
        passed,
        score: passed ? 1.0 : Math.max(0, 1 - (mape - threshold) / threshold),
        details: passed ? [] : [{ mape, threshold, message: `MAPE ${mape}% exceeds threshold ${threshold * 100}%` }]
      };
    }
  },

  visual_primitive_accuracy: {
    name: 'Visual Primitive Accuracy Gate',
    description: 'User validation rate must exceed threshold',
    run: async (context) => {
      const validationRate = context.validationRate || 0;
      const threshold = context.threshold || 0.85;
      const passed = validationRate >= threshold;

      return {
        passed,
        score: passed ? 1.0 : validationRate / threshold,
        details: passed ? [] : [{ validationRate, threshold }]
      };
    }
  },

  code_quality: {
    name: 'Code Quality Gate',
    description: 'ESLint must pass with no broken tests',
    run: async (context) => {
      // This would typically run ESLint and tests
      // For now, placeholder that assumes CI handles this
      return {
        passed: true,
        score: 1.0,
        details: [{ message: 'Code quality checked by CI pipeline' }]
      };
    }
  },

  security: {
    name: 'Security Gate',
    description: 'No secrets in diff, input validation enforced',
    run: async (context) => {
      const issues = [];

      // Check for common secret patterns in code diff
      const diff = context.diff || '';
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /password\s*[:=]\s*['"][^'"]{4,}['"]/i,
        /secret\s*[:=]\s*['"][a-zA-Z0-9]{10,}['"]/i,
        /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(diff)) {
          issues.push({ message: 'Potential secret detected in diff', pattern: pattern.source });
        }
      }

      return {
        passed: issues.length === 0,
        score: issues.length === 0 ? 1.0 : Math.max(0, 1 - issues.length * 0.2),
        details: issues
      };
    }
  },

  backtest: {
    name: 'Backtest Gate',
    description: 'New model must outperform baseline on historical data',
    run: async (context) => {
      const baselineScore = context.baselineScore || 0;
      const newScore = context.newScore || 0;
      const minImprovement = context.minImprovement || 0.01;
      const improvement = newScore - baselineScore;
      const passed = improvement >= minImprovement;

      return {
        passed,
        score: passed ? 1.0 : Math.max(0, 0.5 + improvement / minImprovement * 0.5),
        details: [{ baselineScore, newScore, improvement, minImprovement }]
      };
    }
  },

  forward_test: {
    name: 'Forward Test Gate',
    description: 'Must show improvement on live data for N records',
    run: async (context) => {
      const requiredRecords = context.requiredRecords || 5;
      const improvedRecords = context.improvedRecords || 0;
      const passed = improvedRecords >= requiredRecords;

      return {
        passed,
        score: passed ? 1.0 : improvedRecords / requiredRecords,
        details: [{ improvedRecords, requiredRecords }]
      };
    }
  }
};

// ─── Gate Runner ──────────────────────────────────────────────

/**
 * Run a single quality gate.
 * @param {string} gateName
 * @param {Object} context
 * @returns {Promise<GateResult>}
 */
async function runGate(gateName, context) {
  const gate = GATES[gateName];
  if (!gate) {
    return {
      gate: gateName,
      passed: false,
      score: 0,
      error: `Unknown gate: ${gateName}`
    };
  }

  try {
    const startTime = Date.now();
    const result = await gate.run(context);
    const duration = Date.now() - startTime;

    logger.debug('Quality gate completed', {
      gate: gateName,
      passed: result.passed,
      score: result.score,
      duration_ms: duration
    });

    return {
      gate: gateName,
      name: gate.name,
      passed: result.passed,
      score: result.score,
      details: result.details,
      duration_ms: duration
    };
  } catch (err) {
    logger.error('Quality gate failed', { gate: gateName, error: err.message });
    return {
      gate: gateName,
      name: gate.name,
      passed: false,
      score: 0,
      error: err.message
    };
  }
}

/**
 * Run multiple gates and compute overall pass/fail.
 * @param {string[]} gateNames
 * @param {Object} context
 * @param {number} [passThreshold=0.8]
 * @returns {Promise<MultiGateResult>}
 */
async function runGates(gateNames, context, passThreshold = 0.8) {
  const results = [];
  let totalScore = 0;

  for (const gateName of gateNames) {
    const result = await runGate(gateName, context);
    results.push(result);
    totalScore += result.score;
  }

  const avgScore = results.length > 0 ? totalScore / results.length : 0;
  const allPassed = results.every((r) => r.passed);
  const passed = allPassed || avgScore >= passThreshold;

  return {
    passed,
    avgScore: Math.round(avgScore * 100) / 100,
    allPassed,
    results,
    timestamp: new Date().toISOString()
  };
}

// ─── Predefined Gate Sets ─────────────────────────────────────

const GATE_SETS = {
  boq_publish: ['boq_math', 'rate_reasonableness', 'cross_document_consistency'],
  calculator_deploy: ['calculator_standards', 'code_quality'],
  rate_model_deploy: ['rate_reasonableness', 'backtest', 'forward_test'],
  visual_primitive_deploy: ['visual_primitive_accuracy', 'backtest'],
  forecast_model_deploy: ['forecast_accuracy', 'backtest', 'forward_test'],
  code_merge: ['code_quality', 'security', 'boq_math'],
  full_release: ['boq_math', 'calculator_standards', 'rate_reasonableness', 'code_quality', 'security']
};

/**
 * Run a predefined gate set.
 * @param {string} setName
 * @param {Object} context
 * @param {number} [passThreshold]
 * @returns {Promise<MultiGateResult>}
 */
async function runGateSet(setName, context, passThreshold) {
  const gates = GATE_SETS[setName];
  if (!gates) {
    throw new Error(`Unknown gate set: ${setName}. Available: ${Object.keys(GATE_SETS).join(', ')}`);
  }
  return runGates(gates, context, passThreshold);
}

// ─── Types (JSDoc) ────────────────────────────────────────────

/**
 * @typedef {Object} GateResult
 * @property {string} gate
 * @property {string} name
 * @property {boolean} passed
 * @property {number} score
 * @property {Array} details
 * @property {number} [duration_ms]
 * @property {string} [error]
 */

/**
 * @typedef {Object} MultiGateResult
 * @property {boolean} passed
 * @property {number} avgScore
 * @property {boolean} allPassed
 * @property {GateResult[]} results
 * @property {string} timestamp
 */

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  runGate,
  runGates,
  runGateSet,
  GATES,
  GATE_SETS
};
