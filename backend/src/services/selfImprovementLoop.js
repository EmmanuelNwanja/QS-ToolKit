/**
 * selfImprovementLoop.js
 * Core self-improvement engine for QSToolkit.
 * Implements the recursive loop: Sensor → Policy → Tool → Quality Gate → Learn
 *
 * Inspired by YC Partner Tom Blomfield's "Self-Improving Company" thesis:
 * The platform collects signals, decides, acts, validates, and learns —
 * getting smarter while the team sleeps.
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { evaluate } = require('./policyEngine');
const { runGateSet } = require('./qualityGateEngine');

// ─── Loop Types ───────────────────────────────────────────────

const LOOP_TYPES = [
  'calculator_defaults',   // Auto-adjust calculator default assumptions
  'rate_intelligence',     // Auto-tune rate suggestion model weights
  'auto_boq_accuracy',     // Retrain visual primitive prompts
  'support_product',       // Auto-generate FAQ / UI hints from chat patterns
  'forecast_accuracy'      // Auto-tune forecast coefficients
];

const LOOP_CONFIG = {
  calculator_defaults: {
    name: 'Calculator Defaults Loop',
    description: 'Adjust calculator default assumptions based on user override patterns',
    sensors: ['calculator'],
    gateSet: 'calculator_deploy',
    passThreshold: 0.9
  },
  rate_intelligence: {
    name: 'Rate Intelligence Loop',
    description: 'Tune rate suggestion weights based on acceptance/override patterns',
    sensors: ['rate'],
    gateSet: 'rate_model_deploy',
    passThreshold: 0.85
  },
  auto_boq_accuracy: {
    name: 'Auto-BOQ Accuracy Loop',
    description: 'Improve visual primitive prompts based on user corrections',
    sensors: ['drawing'],
    gateSet: 'visual_primitive_deploy',
    passThreshold: 0.85
  },
  support_product: {
    name: 'Support → Product Loop',
    description: 'Generate FAQ and UI hints from recurring support chat patterns',
    sensors: ['support'],
    gateSet: null, // No automated gate — measured by chat volume reduction
    passThreshold: 0.8
  },
  forecast_accuracy: {
    name: 'Forecast Accuracy Loop',
    description: 'Tune forecast coefficients based on predicted vs actual accuracy',
    sensors: ['forecast'],
    gateSet: 'forecast_model_deploy',
    passThreshold: 0.85
  }
};

// ─── Main Loop ────────────────────────────────────────────────

/**
 * Start a self-improvement loop from a sensor event.
 * @param {string} loopType
 * @param {string} triggerEventId
 * @returns {Promise<LoopRunResult>}
 */
async function startLoop(loopType, triggerEventId) {
  if (!LOOP_TYPES.includes(loopType)) {
    throw new Error(`Unknown loop type: ${loopType}. Must be one of: ${LOOP_TYPES.join(', ')}`);
  }

  const config = LOOP_CONFIG[loopType];
  const runId = await createRun(loopType, triggerEventId);

  try {
    logger.info('Starting self-improvement loop', { loopType, runId });

    // ─── DIAGNOSE ─────────────────────────────────────────────
    await updateRunStatus(runId, 'diagnosing');
    const diagnosis = await diagnose(loopType, triggerEventId);
    await updateRunDiagnosis(runId, diagnosis);

    // ─── POLICY CHECK ─────────────────────────────────────────
    const policyResult = await evaluate({
      action_type: getActionType(loopType),
      metadata: diagnosis
    });

    if (policyResult.effect === 'deny') {
      await updateRunStatus(runId, 'failed');
      await logInstinct(loopType, 'policy_denied', diagnosis, 0.1);
      return { runId, status: 'failed', reason: 'Policy denied: ' + policyResult.reason };
    }

    // ─── FIX / TOOL EXECUTION ─────────────────────────────────
    await updateRunStatus(runId, 'fixing');
    const fix = await generateFix(loopType, diagnosis);
    await updateRunFix(runId, fix);

    // ─── QUALITY GATE ─────────────────────────────────────────
    await updateRunStatus(runId, 'verifying');

    let gateResult = null;
    if (config.gateSet) {
      gateResult = await runGateSet(config.gateSet, fix.context, config.passThreshold);
      await updateRunGateResults(runId, gateResult);

      if (!gateResult.passed) {
        await updateRunStatus(runId, 'failed');
        await logInstinct(loopType, 'gate_failed', { diagnosis, gateResult }, 0.2);
        return { runId, status: 'failed', reason: 'Quality gate failed', gateResult };
      }
    }

    // ─── HUMAN APPROVAL (if required) ─────────────────────────
    if (policyResult.effect === 'require_approval') {
      await updateRunStatus(runId, 'awaiting_approval');
      // In production, this would send a notification to approvers
      logger.info('Loop awaiting human approval', { runId, approvers: policyResult.approvers });
      return { runId, status: 'awaiting_approval', approvers: policyResult.approvers };
    }

    // ─── DEPLOY ───────────────────────────────────────────────
    await updateRunStatus(runId, 'deployed');
    await deployFix(loopType, fix);

    // ─── LEARN ────────────────────────────────────────────────
    await logInstinct(loopType, 'success', { diagnosis, fix, gateResult }, 0.8);
    await updateRunStatus(runId, 'completed');

    logger.info('Self-improvement loop completed', { loopType, runId });

    return {
      runId,
      status: 'completed',
      diagnosis,
      fix,
      gateResult
    };

  } catch (err) {
    logger.error('Self-improvement loop error', { loopType, runId, error: err.message });
    await updateRunStatus(runId, 'failed');
    await logInstinct(loopType, 'error', { error: err.message }, 0.1);
    throw err;
  }
}

// ─── Diagnosis ────────────────────────────────────────────────

async function diagnose(loopType, triggerEventId) {
  // Fetch the triggering event
  const { data: event } = await supabase
    .from('sensor_events')
    .select('*')
    .eq('id', triggerEventId)
    .single();

  if (!event) {
    throw new Error(`Trigger event not found: ${triggerEventId}`);
  }

  switch (loopType) {
    case 'calculator_defaults':
      return diagnoseCalculatorDefaults(event);
    case 'rate_intelligence':
      return diagnoseRateIntelligence(event);
    case 'auto_boq_accuracy':
      return diagnoseAutoBoqAccuracy(event);
    case 'support_product':
      return diagnoseSupportProduct(event);
    case 'forecast_accuracy':
      return diagnoseForecastAccuracy(event);
    default:
      return { event, analysis: 'No specific diagnosis available' };
  }
}

async function diagnoseCalculatorDefaults(event) {
  const calculatorType = event.payload?.calculator_type;
  const inputHash = event.payload?.input_hash;

  // Find all similar calculator usage in last 30 days
  const { data: usages } = await supabase
    .from('sensor_events')
    .select('*')
    .eq('sensor_type', 'calculator')
    .eq('payload->>calculator_type', calculatorType)
    .eq('payload->>input_hash', inputHash)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const overrideCount = usages?.filter((u) => u.payload?.user_action === 'override').length || 0;
  const totalCount = usages?.length || 0;

  return {
    calculator_type: calculatorType,
    override_count: overrideCount,
    total_count: totalCount,
    override_rate: totalCount > 0 ? overrideCount / totalCount : 0,
    most_overridden_field: event.payload?.most_overridden_field,
    suggestion: overrideCount >= 10
      ? `Consider adjusting default ${event.payload?.most_overridden_field} for ${calculatorType}`
      : 'Not enough data for auto-adjustment'
  };
}

async function diagnoseRateIntelligence(event) {
  const description = event.payload?.description;
  const state = event.payload?.state; // Would need to derive from project context

  // Find rate events for this item description
  const { data: rates } = await supabase
    .from('sensor_events')
    .select('*')
    .eq('sensor_type', 'rate')
    .ilike('payload->>description', `%${description?.slice(0, 50)}%`)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const overrideCount = rates?.filter((r) => r.payload?.user_action === 'overridden').length || 0;
  const totalCount = rates?.length || 0;

  // Calculate average override deviation
  const deviations = rates
    ?.filter((r) => r.payload?.deviation_pct)
    .map((r) => r.payload.deviation_pct) || [];
  const avgDeviation = deviations.length > 0
    ? deviations.reduce((a, b) => a + b, 0) / deviations.length
    : 0;

  return {
    description: description?.slice(0, 100),
    override_count: overrideCount,
    total_count: totalCount,
    override_rate: totalCount > 0 ? overrideCount / totalCount : 0,
    avg_deviation_pct: avgDeviation,
    suggestion: overrideCount >= 5
      ? `Consider adjusting rate model weight for "${description?.slice(0, 50)}" by ${avgDeviation.toFixed(1)}%`
      : 'Not enough override data'
  };
}

async function diagnoseAutoBoqAccuracy(event) {
  const annotationId = event.source_id;
  const correctionType = event.payload?.correction_type;

  // Get accuracy stats for this drawing type
  const { data: stats } = await supabase
    .from('drawing_primitive_accuracy')
    .select('*')
    .eq('drawing_type', event.payload?.drawing_type || 'floor_plan')
    .limit(1)
    .single();

  const errorRate = stats ? (100 - (stats.accuracy_pct || 0)) / 100 : 0;

  return {
    annotation_id: annotationId,
    correction_type: correctionType,
    drawing_type: event.payload?.drawing_type,
    error_rate: errorRate,
    accuracy_stats: stats,
    suggestion: errorRate > 0.10
      ? `Consider adding few-shot examples for ${correctionType} corrections`
      : 'Accuracy within acceptable range'
  };
}

async function diagnoseSupportProduct(event) {
  const topic = event.payload?.topic;

  // Count occurrences of this topic
  const { data: chats } = await supabase
    .from('sensor_events')
    .select('*')
    .eq('sensor_type', 'support')
    .eq('payload->>topic', topic)
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

  return {
    topic,
    occurrence_count: chats?.length || 0,
    last_7_days: chats?.filter((c) =>
      new Date(c.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length || 0,
    suggestion: (chats?.length || 0) >= 5
      ? `Generate FAQ entry for "${topic}"`
      : 'Not enough occurrences for auto-FAQ'
  };
}

async function diagnoseForecastAccuracy(event) {
  const { predicted_value, actual_value, mape } = event.payload || {};

  // Get historical MAPE for this project type
  const projectType = event.payload?.project_type;
  const { data: forecasts } = await supabase
    .from('sensor_events')
    .select('*')
    .eq('sensor_type', 'forecast')
    .eq('payload->>project_type', projectType)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const mapes = forecasts
    ?.map((f) => f.payload?.mape)
    .filter((m) => typeof m === 'number') || [];
  const avgMape = mapes.length > 0 ? mapes.reduce((a, b) => a + b, 0) / mapes.length : 0;

  return {
    project_type: projectType,
    current_mape: mape,
    historical_avg_mape: avgMape,
    total_forecasts: mapes.length,
    suggestion: mape > 20
      ? `Consider retuning forecast coefficients for ${projectType} projects (MAPE: ${mape}%)`
      : 'Forecast accuracy within acceptable range'
  };
}

// ─── Fix Generation ───────────────────────────────────────────

async function generateFix(loopType, diagnosis) {
  // In a full implementation, this would:
  // 1. Generate the actual code/config change
  // 2. Apply it in a safe manner (feature flag, A/B test)
  // 3. Return the fix metadata for deployment

  return {
    loop_type: loopType,
    diagnosis_summary: diagnosis.suggestion,
    change_type: 'config_adjustment', // or 'prompt_update', 'model_retrain', etc.
    context: diagnosis,
    deployment_strategy: 'ab_test', // or 'immediate', 'canary', 'feature_flag'
    rollback_plan: 'Revert to previous config version'
  };
}

// ─── Deployment ───────────────────────────────────────────────

async function deployFix(loopType, fix) {
  logger.info('Deploying fix', { loopType, strategy: fix.deployment_strategy });
  // Placeholder: In production, this would:
  // 1. Write the fix to the appropriate config/prompt file
  // 2. Trigger a reload or restart
  // 3. Log the deployment
}

// ─── Instinct Logging ─────────────────────────────────────────

async function logInstinct(loopType, pattern, context, confidence) {
  try {
    const { data: existing } = await supabase
      .from('agent_instincts')
      .select('*')
      .eq('loop_type', loopType)
      .eq('pattern', pattern)
      .limit(1)
      .single();

    if (existing) {
      const successDelta = confidence >= 0.5 ? 1 : 0;
      const failureDelta = confidence < 0.5 ? 1 : 0;
      const newConfidence = Math.round(
        ((existing.confidence_score * (existing.success_count + existing.failure_count)) + confidence) /
        (existing.success_count + existing.failure_count + 1) * 100
      ) / 100;

      await supabase
        .from('agent_instincts')
        .update({
          success_count: existing.success_count + successDelta,
          failure_count: existing.failure_count + failureDelta,
          confidence_score: newConfidence,
          last_used_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('agent_instincts')
        .insert({
          loop_type: loopType,
          pattern,
          context,
          confidence_score: confidence,
          success_count: confidence >= 0.5 ? 1 : 0,
          failure_count: confidence < 0.5 ? 1 : 0
        });
    }
  } catch (err) {
    logger.error('Failed to log instinct', { error: err.message });
  }
}

// ─── Run Management ───────────────────────────────────────────

async function createRun(loopType, triggerEventId) {
  const { data, error } = await supabase
    .from('improvement_runs')
    .insert({
      loop_type: loopType,
      trigger_event_id: triggerEventId,
      status: 'detected'
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function updateRunStatus(runId, status) {
  const updates = { status };
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }

  await supabase
    .from('improvement_runs')
    .update(updates)
    .eq('id', runId);
}

async function updateRunDiagnosis(runId, diagnosis) {
  await supabase
    .from('improvement_runs')
    .update({ diagnosis })
    .eq('id', runId);
}

async function updateRunFix(runId, fix) {
  await supabase
    .from('improvement_runs')
    .update({
      proposed_fix: fix,
      fix_deployment: fix.deployment_strategy
    })
    .eq('id', runId);
}

async function updateRunGateResults(runId, gateResult) {
  await supabase
    .from('improvement_runs')
    .update({ quality_gate_results: gateResult })
    .eq('id', runId);
}

// ─── Helpers ──────────────────────────────────────────────────

function getActionType(loopType) {
  const map = {
    calculator_defaults: 'adjust_calculator_defaults',
    rate_intelligence: 'deploy_rate_model',
    auto_boq_accuracy: 'retrain_visual_primitives',
    support_product: 'auto_generate_faq',
    forecast_accuracy: 'tune_forecast_coefficients'
  };
  return map[loopType] || loopType;
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  startLoop,
  diagnose,
  LOOP_TYPES,
  LOOP_CONFIG
};
