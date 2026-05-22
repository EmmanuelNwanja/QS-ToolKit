-- Admin AI Engine: grants table + conversation context type support
-- Super admins get automatic access. Regular admins need explicit grant.

CREATE TABLE IF NOT EXISTS admin_ai_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_admin_ai_grants_user_id ON admin_ai_grants(user_id);

-- Add context_type 'admin' support already exists via ai_conversations text column,
-- but ensure RLS is in place for admin_ai_grants
ALTER TABLE admin_ai_grants ENABLE ROW LEVEL SECURITY;

-- Only super_admins and the granted user can read grants
CREATE POLICY admin_ai_grants_select ON admin_ai_grants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND org_role = 'super_admin'
    )
    OR user_id = auth.uid()
  );

-- Only super_admins can insert/delete grants
CREATE POLICY admin_ai_grants_write ON admin_ai_grants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND org_role = 'super_admin'
    )
  );

COMMENT ON TABLE admin_ai_grants IS 'Tracks which admin users have been granted access to the Admin AI Engine by a super admin.';
