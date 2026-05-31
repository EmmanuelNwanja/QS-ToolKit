/**
 * Parametric Module — Admin Toggle
 *
 * Provides runtime per-environment toggle for the parametric engine.
 * NOTE: This toggle is in-memory only and resets on deploy.
 * For permanent per-tenant control, integrate with `platform_settings` table.
 */

let _runtimeOverride = null; // null = use env var, true/false = override

exports.getStatus = (req, res) => {
  const envValue = process.env.PARAMETRIC_ENGINE_ENABLED === 'true';
  const effective = _runtimeOverride !== null ? _runtimeOverride : envValue;
  res.json({
    enabled: effective,
    source: _runtimeOverride !== null ? 'runtime_override' : 'environment_variable',
    env_value: envValue,
    runtime_override: _runtimeOverride
  });
};

exports.toggle = (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be boolean' });
  }
  _runtimeOverride = enabled;
  res.json({
    enabled,
    source: 'runtime_override',
    note: 'This toggle is in-memory only and resets on deploy.'
  });
};

exports.reset = (req, res) => {
  _runtimeOverride = null;
  res.json({
    enabled: process.env.PARAMETRIC_ENGINE_ENABLED === 'true',
    source: 'environment_variable',
    note: 'Runtime override cleared. Now using environment variable.'
  });
};
