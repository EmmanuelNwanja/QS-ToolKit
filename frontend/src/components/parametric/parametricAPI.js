/**
 * Design Compliance Checklist:
 * ─────────────────────────────
 * [x] No UI — pure API wrapper, no tokens needed
 * [x] Imports existing shared api client (no modification)
 * [x] Feature-flag gated (defaults to noop when disabled)
 * [x] Routes under /parametric/ (matching backend /api/v1/parametric/)
 */

import api from '../../services/api';

const ENV_FLAG = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED === 'true';

const endpoints = {
  calculate:         (d) => api.post('/parametric/calculate', d),
  calculateCircular: (d) => api.post('/parametric/calculate/circular', d),
  calculateCylindrical: (d) => api.post('/parametric/calculate/cylindrical', d),
  calculateCurved:   (d) => api.post('/parametric/calculate/curved', d),
  calculateDome:     (d) => api.post('/parametric/calculate/dome', d),
  compare:           (d) => api.post('/parametric/calculate/compare', d),
  typologies:        ()  => api.get('/parametric/typologies'),
  standardRules:     (code, params) => api.get(`/parametric/standards/${code}/rules`, { params }),
  injectBoq:         (id, d) => api.post(`/parametric/calculations/${id}/inject-boq`, d),
  applyOverride:     (id, d) => api.put(`/parametric/calculations/${id}/override`, d)
};

function noop() {
  return Promise.reject(new Error('Parametric Engine is disabled'));
}

const parametricAPI = {};
for (const [key, fn] of Object.entries(endpoints)) {
  parametricAPI[key] = ENV_FLAG ? fn : noop;
}

export default parametricAPI;
export { ENV_FLAG as isParametricEnabled };
