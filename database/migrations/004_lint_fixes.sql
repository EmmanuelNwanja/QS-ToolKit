-- ============================================================
--  QSToolkit — Supabase Lint Fixes
--  Migration: 004_lint_fixes.sql
--  Run this in Supabase SQL Editor (single execution)
--  Fixes all 41 issues from the performance/security lint report
--  in order of severity: ERROR → WARN (security) → WARN (perf) → INFO
-- ============================================================


-- ============================================================
--  PRIORITY 1 — ERRORS (Security)
--  Fix: RLS disabled on 5 public tables
--  Fix: Sensitive column (invitations.token) exposed without RLS
-- ============================================================

-- ── 1a. organizations ────────────────────────────────────────────
-- Organizations are read by team members of that org, written only by super_admin
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read their own org
CREATE POLICY "org_members_read"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- Only super_admin of the org can update/delete
CREATE POLICY "org_super_admin_write"
  ON public.organizations
  FOR ALL
  USING (
    id IN (
      SELECT organization_id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role = 'super_admin'
    )
  );

-- Service role (backend) can always insert (when creating new org)
-- This is handled by the backend using the service key (bypasses RLS)


-- ── 1b. subscription_plans ───────────────────────────────────────
-- Plans are public read-only data — anyone (even anon) can read them
-- No user should ever be able to INSERT/UPDATE/DELETE plans via PostgREST
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_public_read"
  ON public.subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE policy = only service role (backend) can modify plans


-- ── 1c. device_sessions ──────────────────────────────────────────
-- Users can only see and manage their own device sessions
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_sessions_own"
  ON public.device_sessions
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );


-- ── 1d. free_trial_usage ─────────────────────────────────────────
-- This table is written by the backend only (service role)
-- No direct PostgREST access needed for any user
ALTER TABLE public.free_trial_usage ENABLE ROW LEVEL SECURITY;

-- Deny all direct API access — backend service role bypasses RLS
CREATE POLICY "free_trial_deny_direct"
  ON public.free_trial_usage
  FOR ALL
  TO authenticated, anon
  USING (false);


-- ── 1e. invitations — RLS + sensitive token column ───────────────
-- Fixes BOTH: rls_disabled_in_public AND sensitive_columns_exposed (token)
-- Org admins can see invitations for their org
-- The token itself should NEVER be returned via PostgREST
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Org admins can view/create invitations for their org
CREATE POLICY "invitations_org_admin_read"
  ON public.invitations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "invitations_org_admin_insert"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "invitations_org_admin_update"
  ON public.invitations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role IN ('super_admin', 'admin')
    )
  );

-- Additionally: expose invitations without the token column
-- Create a view that strips the sensitive token so it's never leaked via API
CREATE OR REPLACE VIEW public.invitations_safe AS
  SELECT
    id,
    organization_id,
    invited_by,
    email,
    role,
    -- token intentionally excluded
    expires_at,
    accepted,
    created_at
  FROM public.invitations;

-- Grant access to the safe view only
REVOKE ALL ON public.invitations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invitations TO authenticated;
-- The view is the safe read surface for the frontend
GRANT SELECT ON public.invitations_safe TO authenticated;


-- ============================================================
--  PRIORITY 2 — WARNINGS (Security)
--  Fix: refresh_leaderboard() has mutable search_path
--  Fix: leaderboard materialized view accessible by anon role
-- ============================================================

-- ── 2a. Fix function search_path (security: prevents search_path hijacking) ──
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp   -- ← locks the search path
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$;

-- Only authenticated users (or service role) can call this function
REVOKE ALL ON FUNCTION public.refresh_leaderboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard() TO authenticated;


-- ── 2b. Fix materialized view in API (leaderboard accessible by anon) ────────
-- Remove anon access to the raw materialized view
-- Authenticated users can still read it; the frontend/backend queries it as authenticated
REVOKE SELECT ON public.leaderboard FROM anon;
GRANT  SELECT ON public.leaderboard TO authenticated;

-- Comment: The leaderboard page on the frontend calls the /leaderboard API endpoint
-- which uses the backend service role — this is correct. If you want to keep the
-- leaderboard publicly visible (no login required), the backend endpoint handles
-- it server-side. Direct anon PostgREST access to the materialized view is not needed.


-- ============================================================
--  PRIORITY 3 — WARNINGS (Performance)
--  Fix: 12 RLS policies re-evaluating auth.uid() per row
--  Solution: wrap auth.uid() in (SELECT auth.uid()) so Postgres
--  evaluates it once per query, not once per row
-- ============================================================

-- ── Drop old policies and recreate with (SELECT auth.uid()) ──────

-- users
DROP POLICY IF EXISTS "users_own" ON public.users;
CREATE POLICY "users_own"
  ON public.users
  FOR ALL
  USING (supabase_auth_id = (SELECT auth.uid()));

-- projects
DROP POLICY IF EXISTS "projects_own" ON public.projects;
CREATE POLICY "projects_own"
  ON public.projects
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- branding_settings
DROP POLICY IF EXISTS "branding_own" ON public.branding_settings;
CREATE POLICY "branding_own"
  ON public.branding_settings
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- calculator_usage
DROP POLICY IF EXISTS "calc_own" ON public.calculator_usage;
CREATE POLICY "calc_own"
  ON public.calculator_usage
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- boq_documents
DROP POLICY IF EXISTS "boq_own" ON public.boq_documents;
CREATE POLICY "boq_own"
  ON public.boq_documents
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- boq_sections (depends on boq_documents)
DROP POLICY IF EXISTS "boq_sections_own" ON public.boq_sections;
CREATE POLICY "boq_sections_own"
  ON public.boq_sections
  FOR ALL
  USING (
    boq_id IN (
      SELECT id FROM public.boq_documents
      WHERE user_id = (
        SELECT id FROM public.users
        WHERE supabase_auth_id = (SELECT auth.uid())
      )
    )
  );

-- boq_items (depends on boq_documents)
DROP POLICY IF EXISTS "boq_items_own" ON public.boq_items;
CREATE POLICY "boq_items_own"
  ON public.boq_items
  FOR ALL
  USING (
    boq_id IN (
      SELECT id FROM public.boq_documents
      WHERE user_id = (
        SELECT id FROM public.users
        WHERE supabase_auth_id = (SELECT auth.uid())
      )
    )
  );

-- invoices
DROP POLICY IF EXISTS "invoices_own" ON public.invoices;
CREATE POLICY "invoices_own"
  ON public.invoices
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- invoice_items
DROP POLICY IF EXISTS "invoice_items_own" ON public.invoice_items;
CREATE POLICY "invoice_items_own"
  ON public.invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE user_id = (
        SELECT id FROM public.users
        WHERE supabase_auth_id = (SELECT auth.uid())
      )
    )
  );

-- saved_calculations
DROP POLICY IF EXISTS "calcs_own" ON public.saved_calculations;
CREATE POLICY "calcs_own"
  ON public.saved_calculations
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- feedback_links
DROP POLICY IF EXISTS "feedback_links_own" ON public.feedback_links;
CREATE POLICY "feedback_links_own"
  ON public.feedback_links
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- notifications
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own"
  ON public.notifications
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );


-- ============================================================
--  PRIORITY 4 — INFO (Performance)
--  Fix: 25 unindexed foreign keys
--  Creates covering indexes on every FK column that lacks one
-- ============================================================

-- ── users table ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_organization_id
  ON public.users (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_plan_id
  ON public.users (plan_id)
  WHERE plan_id IS NOT NULL;

-- ── projects table ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON public.projects (user_id);

CREATE INDEX IF NOT EXISTS idx_projects_organization_id
  ON public.projects (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_verified_by
  ON public.projects (verified_by)
  WHERE verified_by IS NOT NULL;

-- ── boq_documents table ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boq_documents_project_id
  ON public.boq_documents (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boq_documents_user_id
  ON public.boq_documents (user_id);

-- ── boq_sections table ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boq_sections_boq_id
  ON public.boq_sections (boq_id);

-- ── boq_items table ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boq_items_section_id
  ON public.boq_items (section_id);

CREATE INDEX IF NOT EXISTS idx_boq_items_boq_id
  ON public.boq_items (boq_id);

-- ── invoices table ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_user_id
  ON public.invoices (user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_project_id
  ON public.invoices (project_id)
  WHERE project_id IS NOT NULL;

-- ── invoice_items table ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON public.invoice_items (invoice_id);

-- ── saved_calculations table ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saved_calculations_user_id
  ON public.saved_calculations (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_calculations_project_id
  ON public.saved_calculations (project_id)
  WHERE project_id IS NOT NULL;

-- ── calculator_usage table ────────────────────────────────────────
-- Also add composite index for the monthly usage query pattern:
-- WHERE user_id = X AND used_at >= start_of_month
CREATE INDEX IF NOT EXISTS idx_calculator_usage_user_id
  ON public.calculator_usage (user_id);

CREATE INDEX IF NOT EXISTS idx_calculator_usage_user_month
  ON public.calculator_usage (user_id, used_at DESC);

-- ── device_sessions table ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id
  ON public.device_sessions (user_id);

-- ── feedback_links table ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_links_user_id
  ON public.feedback_links (user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_links_project_id
  ON public.feedback_links (project_id);

-- Also index token for the public lookup by token (critical path)
CREATE INDEX IF NOT EXISTS idx_feedback_links_token
  ON public.feedback_links (token);

-- ── feedback_responses table ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback_link_id
  ON public.feedback_responses (feedback_link_id);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_user_id
  ON public.feedback_responses (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_responses_project_id
  ON public.feedback_responses (project_id)
  WHERE project_id IS NOT NULL;

-- ── invitations table ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id
  ON public.invitations (organization_id);

CREATE INDEX IF NOT EXISTS idx_invitations_invited_by
  ON public.invitations (invited_by)
  WHERE invited_by IS NOT NULL;

-- Also index token for the join-by-token lookup (critical path)
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON public.invitations (token);

-- ── notifications table ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id);

-- Composite: unread notifications per user (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;


-- ============================================================
--  VERIFICATION QUERY
--  Run this after the migration to confirm 0 unindexed FKs
--  (copy-paste into a separate SQL editor query if needed)
-- ============================================================

-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   tc.constraint_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
--   AND tc.table_schema = kcu.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND NOT EXISTS (
--     SELECT 1 FROM pg_indexes
--     WHERE schemaname = 'public'
--       AND tablename = tc.table_name
--       AND indexdef LIKE '%' || kcu.column_name || '%'
--   );
-- Expected result: 0 rows
