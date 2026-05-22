-- Admin AI Engine: grants table + conversation context type support
-- Super admins get automatic access. Regular admins need explicit grant.
-- NOTE: Backend controllers enforce super_admin checks. RLS is minimal.

CREATE TABLE IF NOT EXISTS admin_ai_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_admin_ai_grants_user_id ON admin_ai_grants(user_id);

-- Enable RLS
ALTER TABLE admin_ai_grants ENABLE ROW LEVEL SECURITY;

-- Users can see their own grant row (read-only)
CREATE POLICY admin_ai_grants_select ON admin_ai_grants
  FOR SELECT USING (user_id = auth.uid());

-- All writes go through backend service role (bypasses RLS)
-- No direct INSERT/UPDATE/DELETE policies needed

COMMENT ON TABLE admin_ai_grants IS 'Tracks which admin users have been granted access to the Admin AI Engine by a super admin. Backend enforces role checks.';
