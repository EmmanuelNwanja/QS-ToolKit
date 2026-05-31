/**
 * Parametric Module — entry point.
 *
 * Exports:
 *   router     — Express sub-router (empty if feature disabled)
 *   services   — ParametricEngine, FinishCascadeCalculator, FormworkIntelligence, CompetitiveFeatures
 *   isEnabled  — boolean check for feature flag
 */

const isEnabled = () => process.env.PARAMETRIC_ENGINE_ENABLED === 'true';

let router;
try {
  router = isEnabled() ? require('./routes/parametricRoutes') : require('express').Router();
} catch {
  router = require('express').Router();
}

let services = {};
try {
  if (isEnabled()) {
    services = {
      ParametricEngine: require('./services/ParametricEngine'),
      FinishCascadeCalculator: require('./services/FinishCascadeCalculator'),
      FormworkIntelligence: require('./services/FormworkIntelligence'),
      CompetitiveFeatures: require('./services/CompetitiveFeatures'),
      StandardsRegistry: require('./services/StandardsRegistry')
    };
  }
} catch {
  // Module not available — services remain empty
}

module.exports = { router, services, isEnabled };
