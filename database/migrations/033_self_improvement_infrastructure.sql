-- Migration 033: Self-Improvement Infrastructure
-- Implements the "Company Brain" recursive loop:
-- Sensor → Policy → Tool → Quality Gate → Learn

-- ─── Sensor Event Stream ──────────────────────────────────────

CREATE TABLE sensor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_type text NOT NULL CHECK (sensor_type IN (
    'calculator', 'boq', 'rate', 'forecast', 'support',
    'drawing', 'conversion', 'payment', 'integrity', 'error'
  )),
  source_id text,
  project_id uuid REFERENCES projects(id),
  user_id uuid REFERENCES users(id),
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'anomaly', 'opportunity')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_se_sensor_type ON sensor_events(sensor_type);
CREATE INDEX idx_se_project ON sensor_events(project_id);
CREATE INDEX idx_se_user ON sensor_events(user_id);
CREATE INDEX idx_se_severity ON sensor_events(severity);
CREATE INDEX idx_se_created ON sensor_events(created_at DESC);
CREATE INDEX idx_se_payload_hash ON sensor_events(payload_hash);

-- Partition helper (run manually in production for time-series partitioning)
-- CREATE TABLE sensor_events_y2026m06 PARTITION OF sensor_events
--   FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- ─── Self-Improvement Loop Runs ───────────────────────────────

CREATE TABLE improvement_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_type text NOT NULL CHECK (loop_type IN (
    'calculator_defaults', 'rate_intelligence', 'auto_boq_accuracy',
    'support_product', 'forecast_accuracy'
  )),
  trigger_event_id uuid REFERENCES sensor_events(id),
  status text NOT NULL DEFAULT 'detected' CHECK (status IN (
    'detected', 'diagnosing', 'fixing', 'verifying',
    'awaiting_approval', 'deployed', 'completed', 'failed', 'rolled_back'
  )),
  diagnosis jsonb,
  proposed_fix jsonb,
  fix_deployment text,
  quality_gate_results jsonb,
  human_approver_id uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_ir_loop_type ON improvement_runs(loop_type);
CREATE INDEX idx_ir_status ON improvement_runs(status);
CREATE INDEX idx_ir_trigger ON improvement_runs(trigger_event_id);
CREATE INDEX idx_ir_created ON improvement_runs(created_at DESC);

-- ─── Agent Instincts (Learning Outcomes) ──────────────────────

CREATE TABLE agent_instincts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_type text NOT NULL,
  pattern text NOT NULL,
  context jsonb,
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  success_count int NOT NULL DEFAULT 1,
  failure_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(loop_type, pattern)
);

CREATE INDEX idx_ai_loop_type ON agent_instincts(loop_type);
CREATE INDEX idx_ai_confidence ON agent_instincts(confidence_score DESC);
CREATE INDEX idx_ai_created ON agent_instincts(created_at DESC);

-- ─── Policy Registry ──────────────────────────────────────────

CREATE TABLE agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'project', 'user', 'agent')),
  action_type text NOT NULL,
  condition jsonb NOT NULL,
  effect text NOT NULL CHECK (effect IN ('allow', 'deny', 'require_approval')),
  approver_roles text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ap_action ON agent_policies(action_type);
CREATE INDEX idx_ap_active ON agent_policies(active);

-- ─── Default Policies ─────────────────────────────────────────

INSERT INTO agent_policies (scope, action_type, condition, effect, approver_roles) VALUES
  ('user', 'modify_boq', '{"type": "ownership_check", "resource": "project"}', 'allow', '{}'),
  ('global', 'modify_boq', '{"type": "always"}', 'deny', '{}'),
  ('global', 'deploy_rate_model', '{"type": "deviation_threshold", "threshold": 0.20}', 'allow', '{}'),
  ('global', 'deploy_rate_model', '{"type": "deviation_threshold", "threshold": 0.50}', 'require_approval', '{"admin", "super_admin"}'),
  ('global', 'send_email', '{"type": "template_check", "from_template": false}', 'require_approval', '{"admin"}'),
  ('global', 'generate_invoice', '{"type": "math_validation", "gate": "boq_math"}', 'allow', '{}'),
  ('global', 'certify_document', '{"type": "status_check", "status": "finalized"}', 'allow', '{}'),
  ('global', 'access_financial_data', '{"type": "role_check", "roles": ["admin", "super_admin"]}', 'allow', '{}'),
  ('global', 'retrain_visual_primitives', '{"type": "error_rate", "threshold": 0.10}', 'allow', '{}'),
  ('global', 'auto_generate_faq', '{"type": "chat_frequency", "count": 5, "days": 7}', 'allow', '{}'),
  ('global', 'tune_forecast_coefficients', '{"type": "mape_threshold", "threshold": 0.20}', 'allow', '{}'),
  ('global', 'tune_forecast_coefficients', '{"type": "mape_threshold", "threshold": 0.35}', 'require_approval', '{"admin", "super_admin"}');

-- ─── RPC for Sensor Stats ─────────────────────────────────────

CREATE OR REPLACE FUNCTION get_sensor_stats(
  p_sensor_type text,
  p_since timestamptz,
  p_group_by text DEFAULT 'day'
)
RETURNS TABLE (
  period text,
  count bigint,
  anomalies bigint,
  opportunities bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_group_by
      WHEN 'hour' THEN to_char(created_at, 'YYYY-MM-DD HH24:00')
      WHEN 'week' THEN to_char(date_trunc('week', created_at), 'YYYY-MM-DD')
      WHEN 'month' THEN to_char(created_at, 'YYYY-MM')
      ELSE to_char(created_at, 'YYYY-MM-DD')
    END as period,
    count(*) as count,
    count(*) FILTER (WHERE severity = 'anomaly') as anomalies,
    count(*) FILTER (WHERE severity = 'opportunity') as opportunities
  FROM sensor_events
  WHERE sensor_type = p_sensor_type
    AND created_at >= p_since
  GROUP BY period
  ORDER BY period;
END;
$$ LANGUAGE plpgsql;

-- ─── Sensor Events Cleanup Function ───────────────────────────

CREATE OR REPLACE FUNCTION cleanup_old_sensor_events(
  p_retention_days int DEFAULT 90
)
RETURNS int AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM sensor_events
  WHERE severity = 'info'
    AND created_at < now() - interval '1 day' * p_retention_days;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
