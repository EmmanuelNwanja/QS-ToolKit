/**
 * policyEngine.js
 * Agent guardrails for the self-improving platform.
 * Defines what actions agents can take, when human approval is required,
 * and under what conditions actions are denied.
 *
 * Policy: scope + action_type + condition → effect (allow|deny|require_approval)
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// ─── Default Policies ─────────────────────────────────────────

const DEFAULT_POLICIES = [
  {
    scope: 'user',
    action_type: 'modify_boq',
    condition: { type: 'ownership_check', resource: 'project' },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'modify_boq',
    condition: { type: 'always' },
    effect: 'deny',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'deploy_rate_model',
    condition: { type: 'deviation_threshold', threshold: 0.20 },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'deploy_rate_model',
    condition: { type: 'deviation_threshold', threshold: 0.50 },
    effect: 'require_approval',
    approver_roles: ['admin', 'super_admin']
  },
  {
    scope: 'global',
    action_type: 'send_email',
    condition: { type: 'template_check', from_template: false },
    effect: 'require_approval',
    approver_roles: ['admin']
  },
  {
    scope: 'global',
    action_type: 'send_email',
    condition: { type: 'template_check', from_template: true },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'generate_invoice',
    condition: { type: 'math_validation', gate: 'boq_math' },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'generate_invoice',
    condition: { type: 'math_validation', gate: 'boq_math', failed: true },
    effect: 'deny',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'certify_document',
    condition: { type: 'status_check', status: 'finalized' },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'certify_document',
    condition: { type: 'status_check', status: 'draft' },
    effect: 'deny',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'access_financial_data',
    condition: { type: 'role_check', roles: ['admin', 'super_admin'] },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'access_financial_data',
    condition: { type: 'always' },
    effect: 'deny',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'adjust_calculator_defaults',
    condition: { type: 'override_frequency', count: 10, days: 30 },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'retrain_visual_primitives',
    condition: { type: 'error_rate', threshold: 0.10 },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'retrain_visual_primitives',
    condition: { type: 'error_rate', threshold: 0.25 },
    effect: 'require_approval',
    approver_roles: ['admin', 'super_admin']
  },
  {
    scope: 'global',
    action_type: 'auto_generate_faq',
    condition: { type: 'chat_frequency', count: 5, days: 7 },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'tune_forecast_coefficients',
    condition: { type: 'mape_threshold', threshold: 0.20 },
    effect: 'allow',
    approver_roles: []
  },
  {
    scope: 'global',
    action_type: 'tune_forecast_coefficients',
    condition: { type: 'mape_threshold', threshold: 0.35 },
    effect: 'require_approval',
    approver_roles: ['admin', 'super_admin']
  }
];

// ─── Policy Evaluation ────────────────────────────────────────

/**
 * Evaluate whether an action is allowed under current policies.
 * @param {Object} context
 * @param {string} context.action_type - Type of action being attempted
 * @param {string} [context.user_id] - User attempting the action
 * @param {string} [context.project_id] - Related project
 * @param {Object} [context.metadata] - Additional context for condition evaluation
 * @returns {Promise<{effect: 'allow'|'deny'|'require_approval', policy_id?: string, reason: string, approvers?: string[]}>}
 */
async function evaluate(context) {
  try {
    // Load active policies from DB (with defaults as fallback)
    const policies = await loadPolicies();

    // Filter policies matching this action type
    const relevantPolicies = policies.filter((p) => p.action_type === context.action_type);

    if (relevantPolicies.length === 0) {
      logger.warn('No policy found for action', { action_type: context.action_type });
      return { effect: 'deny', reason: 'No policy defined for this action type' };
    }

    // Evaluate each policy in order (most specific first)
    for (const policy of relevantPolicies) {
      const conditionMet = await evaluateCondition(policy.condition, context);

      if (conditionMet) {
        const result = {
          effect: policy.effect,
          policy_id: policy.id,
          reason: `Policy matched: ${policy.scope} scope, ${policy.action_type} action`,
          approvers: policy.approver_roles || []
        };

        logger.debug('Policy evaluation result', {
          action: context.action_type,
          effect: policy.effect,
          policy_id: policy.id
        });

        return result;
      }
    }

    // Default deny if no conditions matched
    return { effect: 'deny', reason: 'No matching policy condition found' };

  } catch (err) {
    logger.error('Policy evaluation failed', { error: err.message, action: context.action_type });
    // Fail-safe: deny on error
    return { effect: 'deny', reason: `Policy engine error: ${err.message}` };
  }
}

// ─── Condition Evaluators ─────────────────────────────────────

async function evaluateCondition(condition, context) {
  switch (condition.type) {
    case 'always':
      return true;

    case 'ownership_check': {
      if (!context.user_id || !context.project_id) return false;
      const { data } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', context.project_id)
        .single();
      return data?.user_id === context.user_id;
    }

    case 'role_check': {
      if (!context.user_id) return false;
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', context.user_id)
        .single();
      return condition.roles.includes(data?.role);
    }

    case 'deviation_threshold': {
      const deviation = context.metadata?.deviation || 0;
      return deviation >= condition.threshold;
    }

    case 'template_check': {
      return context.metadata?.from_template === condition.from_template;
    }

    case 'math_validation': {
      const { validateBoq } = require('./mathValidationService');
      const boq = context.metadata?.boq;
      if (!boq) return condition.failed || false;
      const result = validateBoq(boq);
      return condition.failed ? !result.valid : result.valid;
    }

    case 'status_check': {
      return context.metadata?.status === condition.status;
    }

    case 'override_frequency': {
      const { data } = await supabase
        .from('sensor_events')
        .select('id')
        .eq('sensor_type', 'calculator')
        .eq('payload->>calculator_type', context.metadata?.calculator_type)
        .eq('payload->>user_action', 'override')
        .gte('created_at', new Date(Date.now() - condition.days * 24 * 60 * 60 * 1000).toISOString());
      return (data?.length || 0) >= condition.count;
    }

    case 'error_rate': {
      const errorRate = context.metadata?.error_rate || 0;
      return errorRate >= condition.threshold;
    }

    case 'chat_frequency': {
      const { data } = await supabase
        .from('sensor_events')
        .select('id')
        .eq('sensor_type', 'support')
        .eq('payload->>topic', context.metadata?.topic)
        .gte('created_at', new Date(Date.now() - condition.days * 24 * 60 * 60 * 1000).toISOString());
      return (data?.length || 0) >= condition.count;
    }

    case 'mape_threshold': {
      const mape = context.metadata?.mape || 0;
      return mape >= condition.threshold;
    }

    default:
      logger.warn('Unknown condition type', { condition_type: condition.type });
      return false;
  }
}

// ─── Policy Management ────────────────────────────────────────

async function loadPolicies() {
  try {
    const { data, error } = await supabase
      .from('agent_policies')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      // Return defaults if no DB policies exist
      return DEFAULT_POLICIES.map((p, i) => ({ ...p, id: `default-${i}` }));
    }

    return data.map((p) => ({
      ...p,
      condition: typeof p.condition === 'string' ? JSON.parse(p.condition) : p.condition,
      approver_roles: p.approver_roles || []
    }));
  } catch (err) {
    logger.error('Failed to load policies from DB', { error: err.message });
    return DEFAULT_POLICIES.map((p, i) => ({ ...p, id: `default-${i}` }));
  }
}

/**
 * Add a new policy.
 */
async function addPolicy(policy) {
  const { data, error } = await supabase
    .from('agent_policies')
    .insert({
      scope: policy.scope,
      action_type: policy.action_type,
      condition: policy.condition,
      effect: policy.effect,
      approver_roles: policy.approver_roles || []
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deactivate a policy.
 */
async function deactivatePolicy(policyId) {
  const { error } = await supabase
    .from('agent_policies')
    .update({ active: false })
    .eq('id', policyId);

  if (error) throw error;
  return true;
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  evaluate,
  addPolicy,
  deactivatePolicy,
  loadPolicies,
  DEFAULT_POLICIES
};
