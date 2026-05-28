/**
 * goapPlanner.js
 * Goal-Oriented Action Planning for QSToolkit.
 * Decomposes high-level platform goals into executable action sequences.
 *
 * Example goal: "Reduce BOQ preparation time by 50% for residential projects in Lagos"
 * → Query sensor data → Analyze bottlenecks → Improve Auto-BOQ → A/B test → Deploy
 */

const logger = require('../utils/logger');
const { query: querySensors } = require('./sensorHub');
const { startLoop } = require('./selfImprovementLoop');

// ─── Action Registry ──────────────────────────────────────────

/**
 * Each action has:
 * - preconditions: state keys that must be true
 * - effects: state changes after execution
 * - cost: execution cost (lower = preferred)
 * - execute: async function that performs the action
 */
const ACTIONS = {
  query_sensor_data: {
    preconditions: {},
    effects: { has_sensor_data: true },
    cost: 1,
    execute: async (state) => {
      const events = await querySensors({
        sensor_type: state.sensor_type,
        since: new Date(Date.now() - state.lookback_days * 24 * 60 * 60 * 1000)
      });
      return { ...state, sensor_data: events, has_sensor_data: true };
    }
  },

  analyze_bottlenecks: {
    preconditions: { has_sensor_data: true },
    effects: { bottlenecks_identified: true },
    cost: 2,
    execute: async (state) => {
      const data = state.sensor_data || [];
      // Simple bottleneck analysis
      const bottlenecks = [];

      // Group by metric
      const groups = {};
      for (const event of data) {
        const key = event.payload?.metric || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
      }

      // Find metrics with declining performance
      for (const [metric, events] of Object.entries(groups)) {
        if (events.length < 2) continue;
        const recent = events.slice(-5);
        const avg = recent.reduce((s, e) => s + (e.payload?.value || 0), 0) / recent.length;
        if (avg < (state.target_value || 0)) {
          bottlenecks.push({ metric, current_avg: avg, target: state.target_value });
        }
      }

      return { ...state, bottlenecks, bottlenecks_identified: true };
    }
  },

  improve_auto_boq: {
    preconditions: { bottlenecks_identified: true },
    effects: { auto_boq_improved: true },
    cost: 5,
    execute: async (state) => {
      // Trigger the auto_boq_accuracy improvement loop
      const result = await startLoop('auto_boq_accuracy', state.trigger_event_id);
      return { ...state, auto_boq_improved: result.status === 'completed', improvement_result: result };
    }
  },

  update_rate_model: {
    preconditions: { bottlenecks_identified: true },
    effects: { rate_model_updated: true },
    cost: 4,
    execute: async (state) => {
      const result = await startLoop('rate_intelligence', state.trigger_event_id);
      return { ...state, rate_model_updated: result.status === 'completed', improvement_result: result };
    }
  },

  adjust_calculator_defaults: {
    preconditions: { bottlenecks_identified: true },
    effects: { calculator_defaults_adjusted: true },
    cost: 3,
    execute: async (state) => {
      const result = await startLoop('calculator_defaults', state.trigger_event_id);
      return { ...state, calculator_defaults_adjusted: result.status === 'completed', improvement_result: result };
    }
  },

  ab_test: {
    preconditions: {}, // Can be applied after any improvement
    effects: { ab_test_running: true },
    cost: 2,
    execute: async (state) => {
      // In production: create A/B test via feature flag system
      return { ...state, ab_test_running: true, ab_test_id: `ab-${Date.now()}` };
    }
  },

  measure_impact: {
    preconditions: { ab_test_running: true },
    effects: { impact_measured: true },
    cost: 1,
    execute: async (state) => {
      // Query post-deployment sensor data
      const postEvents = await querySensors({
        sensor_type: state.sensor_type,
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days after
      });

      const improvement = state.baseline_metric
        ? ((state.baseline_metric - (postEvents[0]?.payload?.value || 0)) / state.baseline_metric * 100)
        : 0;

      return { ...state, impact_measured: true, measured_improvement_pct: improvement };
    }
  },

  deploy: {
    preconditions: { impact_measured: true },
    effects: { deployed: true },
    cost: 1,
    execute: async (state) => {
      // In production: promote A/B test winner to 100%
      return { ...state, deployed: true };
    }
  },

  schedule_monitoring: {
    preconditions: { deployed: true },
    effects: { monitoring_scheduled: true },
    cost: 1,
    execute: async (state) => {
      // In production: schedule recurring sensor check
      return { ...state, monitoring_scheduled: true, next_check: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
    }
  }
};

// ─── State Representation ─────────────────────────────────────

function createInitialState(goal) {
  return {
    goal: goal.description,
    target_metric: goal.target_metric,
    target_value: goal.target_value,
    lookback_days: goal.lookback_days || 30,
    sensor_type: goal.sensor_type || 'boq',
    trigger_event_id: goal.trigger_event_id,
    // All state flags start false
    has_sensor_data: false,
    bottlenecks_identified: false,
    auto_boq_improved: false,
    rate_model_updated: false,
    calculator_defaults_adjusted: false,
    ab_test_running: false,
    impact_measured: false,
    deployed: false,
    monitoring_scheduled: false
  };
}

// ─── A* Planner ───────────────────────────────────────────────

/**
 * Plan a sequence of actions to achieve a goal.
 * @param {Object} goal
 * @param {string} goal.description - Human-readable goal description
 * @param {string} goal.target_metric - Metric to improve
 * @param {number} goal.target_value - Target metric value
 * @param {string} [goal.sensor_type='boq']
 * @param {number} [goal.lookback_days=30]
 * @param {string} [goal.trigger_event_id]
 * @returns {Promise<PlanResult>}
 */
async function plan(goal) {
  const startTime = Date.now();
  const initialState = createInitialState(goal);

  // Define goal conditions (all must be true)
  const goalConditions = {
    has_sensor_data: true,
    bottlenecks_identified: true,
    deployed: true,
    monitoring_scheduled: true
  };

  // A* search
  const openSet = [{
    state: initialState,
    actions: [],
    cost: 0,
    heuristic: computeHeuristic(initialState, goalConditions)
  }];

  const visited = new Set();
  const maxIterations = 100;
  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Sort by f = g + h
    openSet.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic));
    const current = openSet.shift();

    const stateKey = JSON.stringify(current.state, Object.keys(current.state).sort());
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    // Check if goal reached
    if (isGoalReached(current.state, goalConditions)) {
      const duration = Date.now() - startTime;
      logger.info('GOAP plan found', {
        goal: goal.description,
        actions: current.actions.map((a) => a.name),
        cost: current.cost,
        iterations,
        duration_ms: duration
      });

      return {
        success: true,
        actions: current.actions,
        estimatedCost: current.cost,
        iterations,
        duration_ms: duration
      };
    }

    // Expand neighbors
    for (const [actionName, action] of Object.entries(ACTIONS)) {
      if (canExecute(action, current.state)) {
        const newState = applyEffects(action, current.state);
        const newActions = [...current.actions, { name: actionName, ...action }];
        const newCost = current.cost + action.cost;

        openSet.push({
          state: newState,
          actions: newActions,
          cost: newCost,
          heuristic: computeHeuristic(newState, goalConditions)
        });
      }
    }
  }

  // No plan found
  logger.warn('GOAP plan not found', { goal: goal.description, iterations });
  return {
    success: false,
    error: 'No valid plan found within iteration limit',
    iterations
  };
}

/**
 * Execute a planned sequence of actions.
 * @param {PlanResult} planResult
 * @returns {Promise<{success: boolean, finalState: Object, executedActions: string[], errors: string[]}>}
 */
async function executePlan(planResult) {
  if (!planResult.success) {
    return { success: false, error: 'Cannot execute failed plan' };
  }

  let state = createInitialState({ description: 'execution' });
  const executedActions = [];
  const errors = [];

  for (const actionDef of planResult.actions) {
    try {
      logger.info('Executing GOAP action', { action: actionDef.name });
      state = await actionDef.execute(state);
      executedActions.push(actionDef.name);
    } catch (err) {
      logger.error('GOAP action failed', { action: actionDef.name, error: err.message });
      errors.push(`${actionDef.name}: ${err.message}`);
      // Continue with remaining actions (replanning could happen here)
    }
  }

  return {
    success: errors.length === 0,
    finalState: state,
    executedActions,
    errors
  };
}

// ─── Planning Helpers ─────────────────────────────────────────

function canExecute(action, state) {
  for (const [key, value] of Object.entries(action.preconditions)) {
    if (state[key] !== value) return false;
  }
  return true;
}

function applyEffects(action, state) {
  return { ...state, ...action.effects };
}

function isGoalReached(state, goalConditions) {
  for (const [key, value] of Object.entries(goalConditions)) {
    if (state[key] !== value) return false;
  }
  return true;
}

function computeHeuristic(state, goalConditions) {
  // Simple heuristic: count of unsatisfied goal conditions
  let count = 0;
  for (const [key, value] of Object.entries(goalConditions)) {
    if (state[key] !== value) count++;
  }
  return count;
}

// ─── Types (JSDoc) ────────────────────────────────────────────

/**
 * @typedef {Object} PlanResult
 * @property {boolean} success
 * @property {Array} [actions]
 * @property {number} [estimatedCost]
 * @property {number} [iterations]
 * @property {number} [duration_ms]
 * @property {string} [error]
 */

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  plan,
  executePlan,
  ACTIONS
};
