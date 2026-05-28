/**
 * agentSwarm.js
 * Specialist agent swarm coordinator for QSToolkit.
 * Routes tasks to the right specialist agent and coordinates multi-step workflows.
 *
 * Swarm:
 *   Dr. Q       → Customer-facing QS assistant (Sonnet-level reasoning)
 *   BoqAgent    → BOQ validator & optimizer (Haiku for speed)
 *   RateAgent   → Rate intelligence updater (Haiku for aggregation)
 *   ForecastAgent → Forecast accuracy monitor (Haiku for stats)
 *   SupportAgent → Chat classifier & responder (Haiku for classification)
 *   CodeAgent   → Bug diagnosis & fix proposal (Sonnet for coding)
 */

const logger = require('../utils/logger');
const { validateBoq } = require('./mathValidationService');
const { startLoop } = require('./selfImprovementLoop');
const { emit } = require('./sensorHub');

// ─── Agent Registry ───────────────────────────────────────────

const AGENTS = {
  drQ: {
    name: 'Dr. Q',
    role: 'Customer-facing QS assistant',
    capabilities: ['chat', 'drawing_analysis', 'faq', 'standards_lookup'],
    model: 'gemini-2.5-pro-exp-03-25',
    costTier: 'high'
  },

  boqAgent: {
    name: 'BoqAgent',
    role: 'BOQ validator & optimizer',
    capabilities: ['validate_math', 'check_compliance', 'suggest_alternatives', 'detect_duplicates'],
    model: 'gemini-2.0-flash',
    costTier: 'low'
  },

  rateAgent: {
    name: 'RateAgent',
    role: 'Rate intelligence updater',
    capabilities: ['aggregate_rates', 'detect_market_shifts', 'update_weights', 'flag_anomalies'],
    model: 'gemini-2.0-flash',
    costTier: 'low'
  },

  forecastAgent: {
    name: 'ForecastAgent',
    role: 'Forecast accuracy monitor',
    capabilities: ['compare_predicted_actual', 'flag_bias', 'suggest_coefficients', 'backtest'],
    model: 'gemini-2.0-flash',
    costTier: 'low'
  },

  supportAgent: {
    name: 'SupportAgent',
    role: 'Chat classifier & responder',
    capabilities: ['classify_topic', 'suggest_faq', 'escalate', 'log_patterns'],
    model: 'gemini-2.0-flash',
    costTier: 'low'
  },

  codeAgent: {
    name: 'CodeAgent',
    role: 'Bug diagnosis & fix proposal',
    capabilities: ['read_code', 'run_tests', 'propose_fix', 'security_scan'],
    model: 'gemini-2.5-pro-exp-03-25',
    costTier: 'high'
  }
};

// ─── Task Router ──────────────────────────────────────────────

/**
 * Route a task to the most appropriate agent(s).
 * @param {Object} task
 * @param {string} task.type - Task type
 * @param {Object} task.payload - Task data
 * @param {string} [task.userId] - Initiating user
 * @returns {Promise<TaskResult>}
 */
async function routeTask(task) {
  const startTime = Date.now();
  logger.info('Routing task to swarm', { taskType: task.type, userId: task.userId });

  switch (task.type) {
    case 'boq_validation':
      return runBoqValidation(task);
    case 'rate_suggestion':
      return runRateSuggestion(task);
    case 'forecast_check':
      return runForecastCheck(task);
    case 'support_chat':
      return runSupportClassification(task);
    case 'drawing_analysis':
      return runDrawingAnalysis(task);
    case 'code_review':
      return runCodeReview(task);
    case 'self_improvement':
      return runSelfImprovement(task);
    default:
      // Default to Dr. Q
      return { agent: 'drQ', result: null, error: `Unknown task type: ${task.type}` };
  }
}

// ─── Specialist Agent Runners ─────────────────────────────────

async function runBoqValidation(task) {
  const startTime = Date.now();
  const agent = AGENTS.boqAgent;
  const boq = task.payload?.boq;

  if (!boq) {
    return { agent: agent.name, result: null, error: 'No BOQ provided' };
  }

  const validation = validateBoq(boq);

  // Emit sensor event
  await emit({
    sensor_type: 'boq',
    user_id: task.userId,
    payload: {
      action: 'validated',
      valid: validation.valid,
      error_count: validation.errors.length,
      warning_count: validation.warnings.length
    }
  });

  return {
    agent: agent.name,
    result: validation,
    duration_ms: Date.now() - startTime
  };
}

async function runRateSuggestion(task) {
  const startTime = Date.now();
  const agent = AGENTS.rateAgent;
  const { description, unit, userId } = task.payload || {};

  // This would typically call rateSuggestionService
  // For now, return the agent assignment
  return {
    agent: agent.name,
    result: {
      description,
      unit,
      assigned: true,
      note: 'Rate suggestion delegated to RateAgent'
    },
    duration_ms: Date.now() - startTime
  };
}

async function runForecastCheck(task) {
  const startTime = Date.now();
  const agent = AGENTS.forecastAgent;
  const { projectId, predicted, actual } = task.payload || {};

  const mape = actual > 0 ? Math.abs(predicted - actual) / actual : 0;

  // Emit sensor event for the self-improvement loop
  await emit({
    sensor_type: 'forecast',
    project_id: projectId,
    payload: {
      predicted_value: predicted,
      actual_value: actual,
      mape: Math.round(mape * 10000) / 100
    },
    severity: mape > 0.35 ? 'anomaly' : mape > 0.20 ? 'warning' : 'info'
  });

  return {
    agent: agent.name,
    result: { mape: Math.round(mape * 10000) / 100, within_threshold: mape < 0.15 },
    duration_ms: Date.now() - startTime
  };
}

async function runSupportClassification(task) {
  const startTime = Date.now();
  const agent = AGENTS.supportAgent;
  const { message, userId } = task.payload || {};

  // Simple keyword-based classification
  const topics = {
    calculator: /calculator|compute|calculate|quantity|blocks|concrete|paint|tiles|steel|plaster/,
    boq: /boq|bill of quantity|document|export|pdf|excel|invoice/,
    payment: /payment|subscribe|plan|upgrade|billing|paystack/,
    account: /account|login|password|email|verify|profile/,
    ai: /dr\.? q|ai|assistant|chat|help me with/
  };

  const matchedTopics = [];
  const lowerMsg = message?.toLowerCase() || '';
  for (const [topic, regex] of Object.entries(topics)) {
    if (regex.test(lowerMsg)) matchedTopics.push(topic);
  }

  const primaryTopic = matchedTopics[0] || 'general';

  // Emit sensor event
  await emit({
    sensor_type: 'support',
    user_id: userId,
    payload: {
      topic: primaryTopic,
      message_length: message?.length || 0,
      matched_topics: matchedTopics
    }
  });

  return {
    agent: agent.name,
    result: { topic: primaryTopic, matchedTopics, confidence: matchedTopics.length > 0 ? 0.8 : 0.3 },
    duration_ms: Date.now() - startTime
  };
}

async function runDrawingAnalysis(task) {
  const startTime = Date.now();
  const agent = AGENTS.drQ; // Dr. Q handles drawing analysis
  return {
    agent: agent.name,
    result: { assigned: true, note: 'Drawing analysis delegated to Dr. Q with visual primitives' },
    duration_ms: Date.now() - startTime
  };
}

async function runCodeReview(task) {
  const startTime = Date.now();
  const agent = AGENTS.codeAgent;
  return {
    agent: agent.name,
    result: { assigned: true, note: 'Code review delegated to CodeAgent' },
    duration_ms: Date.now() - startTime
  };
}

async function runSelfImprovement(task) {
  const startTime = Date.now();
  const { loopType, triggerEventId } = task.payload || {};

  try {
    const result = await startLoop(loopType, triggerEventId);
    return {
      agent: 'SelfImprovementLoop',
      result,
      duration_ms: Date.now() - startTime
    };
  } catch (err) {
    return {
      agent: 'SelfImprovementLoop',
      result: null,
      error: err.message,
      duration_ms: Date.now() - startTime
    };
  }
}

// ─── Multi-Agent Workflow ─────────────────────────────────────

/**
 * Run a multi-agent workflow for complex tasks.
 * Example: "Validate BOQ → Suggest Rates → Check Forecast"
 * @param {string} workflowName
 * @param {Object} context
 * @returns {Promise<WorkflowResult>}
 */
async function runWorkflow(workflowName, context) {
  const workflows = {
    boq_full_check: [
      { type: 'boq_validation', payload: { boq: context.boq } },
      { type: 'rate_suggestion', payload: { description: context.description, unit: context.unit } }
    ],
    project_health_check: [
      { type: 'forecast_check', payload: { projectId: context.projectId, predicted: context.predicted, actual: context.actual } },
      { type: 'boq_validation', payload: { boq: context.boq } }
    ]
  };

  const steps = workflows[workflowName];
  if (!steps) {
    throw new Error(`Unknown workflow: ${workflowName}`);
  }

  const results = [];
  for (const step of steps) {
    const result = await routeTask({ ...step, userId: context.userId });
    results.push(result);
  }

  return {
    workflow: workflowName,
    steps: results,
    allPassed: results.every((r) => !r.error)
  };
}

// ─── Helpers ──────────────────────────────────────────────────

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  routeTask,
  runWorkflow,
  AGENTS
};
