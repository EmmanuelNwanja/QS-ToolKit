/**
 * sensorHub.js
 * Unified event bus for platform sensor data.
 * Collects signals from all QSToolkit domains for the self-improvement loop.
 *
 * Sensor → Policy → Tool → Quality Gate → Learn
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ─── Configuration ────────────────────────────────────────────

const SENSOR_TYPES = [
  'calculator',    // Calculator usage patterns
  'boq',          // BOQ creation, editing, export
  'rate',         // Rate suggestion acceptance/override
  'forecast',     // Forecast accuracy vs actuals
  'support',      // Dr. Q chat classification
  'drawing',      // Visual primitive accuracy
  'conversion',   // User funnel metrics
  'payment',      // Payment success/failure
  'integrity',    // Document certification events
  'error'         // Platform errors
];

const SEVERITY_LEVELS = ['info', 'warning', 'anomaly', 'opportunity'];

// ─── Sensor Event ─────────────────────────────────────────────

/**
 * Emit a sensor event to the hub.
 * @param {Object} event
 * @param {string} event.sensor_type - One of SENSOR_TYPES
 * @param {string} [event.source_id] - ID of the source record
 * @param {string} [event.project_id] - Associated project UUID
 * @param {string} [event.user_id] - Associated user UUID
 * @param {Object} event.payload - Arbitrary event data
 * @param {string} [event.severity='info'] - info|warning|anomaly|opportunity
 * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
 */
async function emit(event) {
  try {
    // Validation
    if (!event.sensor_type || !SENSOR_TYPES.includes(event.sensor_type)) {
      throw new Error(`Invalid sensor_type: ${event.sensor_type}. Must be one of: ${SENSOR_TYPES.join(', ')}`);
    }

    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('Payload is required and must be an object');
    }

    const severity = event.severity || 'info';
    if (!SEVERITY_LEVELS.includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    // Hash payload for deduplication / integrity
    const payloadHash = hashPayload(event.payload);

    // Check for duplicate within last 5 minutes (simple dedup)
    const { data: existing } = await supabase
      .from('sensor_events')
      .select('id')
      .eq('sensor_type', event.sensor_type)
      .eq('payload_hash', payloadHash)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      logger.debug('Duplicate sensor event deduplicated', {
        sensor_type: event.sensor_type,
        payloadHash: payloadHash.slice(0, 8)
      });
      return { success: true, eventId: existing[0].id, deduplicated: true };
    }

    // Insert event
    const { data, error } = await supabase
      .from('sensor_events')
      .insert({
        sensor_type: event.sensor_type,
        source_id: event.source_id || null,
        project_id: event.project_id || null,
        user_id: event.user_id || null,
        payload: event.payload,
        payload_hash: payloadHash,
        severity
      })
      .select('id')
      .single();

    if (error) throw error;

    // If anomaly or opportunity, trigger async analysis
    if (severity === 'anomaly' || severity === 'opportunity') {
      triggerAnalysis(event.sensor_type, data.id, event.payload).catch((err) => {
        logger.error('Async sensor analysis failed', { error: err.message, eventId: data.id });
      });
    }

    logger.debug('Sensor event emitted', {
      sensor_type: event.sensor_type,
      severity,
      eventId: data.id
    });

    return { success: true, eventId: data.id };

  } catch (err) {
    logger.error('Failed to emit sensor event', { error: err.message, sensor_type: event.sensor_type });
    return { success: false, error: err.message };
  }
}

/**
 * Query sensor events with filters.
 * @param {Object} filters
 * @param {string} [filters.sensor_type]
 * @param {string} [filters.severity]
 * @param {string} [filters.project_id]
 * @param {string} [filters.user_id]
 * @param {Date} [filters.since]
 * @param {Date} [filters.until]
 * @param {number} [filters.limit=100]
 * @param {number} [filters.offset=0]
 * @returns {Promise<Array>}
 */
async function query(filters = {}) {
  let query = supabase
    .from('sensor_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.sensor_type) {
    query = query.eq('sensor_type', filters.sensor_type);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.since) {
    query = query.gte('created_at', filters.since.toISOString());
  }
  if (filters.until) {
    query = query.lte('created_at', filters.until.toISOString());
  }

  const limit = Math.min(filters.limit || 100, 1000);
  const offset = filters.offset || 0;

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    logger.error('Sensor query failed', { error: error.message });
    throw error;
  }

  return data || [];
}

/**
 * Get aggregated sensor statistics.
 * @param {string} sensor_type
 * @param {Object} options
 * @param {string} [options.aggregation='count'] - count|avg|sum
 * @param {string} [options.groupBy='day'] - hour|day|week|month
 * @param {number} [options.days=30]
 * @returns {Promise<Array>}
 */
async function getStats(sensor_type, options = {}) {
  const days = options.days || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Use Supabase RPC for complex aggregations
  const { data, error } = await supabase.rpc('get_sensor_stats', {
    p_sensor_type: sensor_type,
    p_since: since,
    p_group_by: options.groupBy || 'day'
  });

  if (error) {
    // Fallback to client-side aggregation if RPC doesn't exist
    logger.warn('Sensor stats RPC not available, using fallback', { error: error.message });
    return fallbackStats(sensor_type, since, options.groupBy || 'day');
  }

  return data || [];
}

// ─── Helpers ──────────────────────────────────────────────────

function hashPayload(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

async function triggerAnalysis(sensorType, eventId, payload) {
  // This will be called asynchronously. In a full implementation,
  // this could enqueue a job to a background worker or call the
  // self-improvement loop directly.
  logger.info('Triggering sensor analysis', { sensorType, eventId });

  // Placeholder: In production, this would integrate with
  // selfImprovementLoop.js to evaluate if this event should
  // trigger an improvement run.
}

async function fallbackStats(sensor_type, since, groupBy) {
  const { data, error } = await supabase
    .from('sensor_events')
    .select('created_at, severity')
    .eq('sensor_type', sensor_type)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Simple client-side grouping
  const groups = {};
  for (const row of data) {
    const date = new Date(row.created_at);
    let key;
    switch (groupBy) {
      case 'hour':
        key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:00`;
        break;
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      }
      case 'month':
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        break;
      default: // day
        key = date.toISOString().split('T')[0];
    }

    if (!groups[key]) {
      groups[key] = { period: key, count: 0, anomalies: 0, opportunities: 0 };
    }
    groups[key].count++;
    if (row.severity === 'anomaly') groups[key].anomalies++;
    if (row.severity === 'opportunity') groups[key].opportunities++;
  }

  return Object.values(groups);
}

// ─── Convenience Emitters ─────────────────────────────────────

/**
 * Emit a calculator usage event.
 */
async function emitCalculatorUsage(userId, calculatorType, inputs, outputs, durationMs) {
  return emit({
    sensor_type: 'calculator',
    user_id: userId,
    payload: {
      calculator_type: calculatorType,
      inputs,
      outputs,
      duration_ms: durationMs,
      input_hash: hashPayload(inputs)
    }
  });
}

/**
 * Emit a BOQ creation/edit event.
 */
async function emitBoqEvent(userId, projectId, boqId, action, boqData) {
  return emit({
    sensor_type: 'boq',
    user_id: userId,
    project_id: projectId,
    source_id: boqId,
    payload: {
      action, // 'created', 'edited', 'exported_pdf', 'exported_excel', 'certified'
      section_count: boqData.sections?.length || 0,
      item_count: boqData.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0,
      total_amount: boqData.total || 0,
      has_ai_suggestions: boqData.has_ai_suggestions || false
    }
  });
}

/**
 * Emit a rate suggestion event.
 */
async function emitRateEvent(userId, projectId, description, suggestedRate, userAction, overrideRate) {
  return emit({
    sensor_type: 'rate',
    user_id: userId,
    project_id: projectId,
    payload: {
      description: description?.slice(0, 200),
      suggested_rate: suggestedRate,
      user_action: userAction, // 'accepted', 'overridden', 'rejected'
      override_rate: overrideRate,
      deviation_pct: overrideRate ? Math.round(((overrideRate - suggestedRate) / suggestedRate) * 10000) / 100 : 0
    },
    severity: userAction === 'rejected' ? 'warning' : 'info'
  });
}

/**
 * Emit a forecast accuracy event.
 */
async function emitForecastEvent(projectId, predictedValue, actualValue) {
  const mape = actualValue > 0
    ? Math.round((Math.abs(predictedValue - actualValue) / actualValue) * 10000) / 100
    : 0;

  return emit({
    sensor_type: 'forecast',
    project_id: projectId,
    payload: {
      predicted_value: predictedValue,
      actual_value: actualValue,
      mape,
      deviation: Math.round((actualValue - predictedValue) * 100) / 100
    },
    severity: mape > 35 ? 'anomaly' : mape > 20 ? 'warning' : 'info'
  });
}

/**
 * Emit a visual primitive feedback event.
 */
async function emitDrawingEvent(projectId, annotationId, correctionType, confidence) {
  return emit({
    sensor_type: 'drawing',
    project_id: projectId,
    source_id: annotationId,
    payload: {
      correction_type: correctionType,
      confidence
    },
    severity: correctionType === 'missed_room' || correctionType === 'false_room' ? 'warning' : 'info'
  });
}

/**
 * Emit a platform error event.
 */
async function emitError(errorType, endpoint, statusCode, message, userId) {
  return emit({
    sensor_type: 'error',
    user_id: userId,
    payload: {
      error_type: errorType,
      endpoint,
      status_code: statusCode,
      message: message?.slice(0, 500)
    },
    severity: statusCode >= 500 ? 'anomaly' : 'warning'
  });
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  emit,
  query,
  getStats,
  emitCalculatorUsage,
  emitBoqEvent,
  emitRateEvent,
  emitForecastEvent,
  emitDrawingEvent,
  emitError,
  SENSOR_TYPES,
  SEVERITY_LEVELS
};
