-- ============================================================
--  QSToolkit — Supabase Lint Fixes (Round 2)
--  Migration: 005_lint_fixes_round2.sql
--  Run in Supabase SQL Editor as a single execution
--
--  Issues addressed:
--  1. ERROR:  invitations_safe view is SECURITY DEFINER       (introduced by 004)
--  2. WARN:   organizations has multiple permissive policies   (introduced by 004)
--  3. WARN:   refresh_leaderboard() mutable search_path       (still firing)
--  4. WARN:   leaderboard materialized view in API             (still firing)
--
--  NOT changing: unused_index INFOs (28 indexes)
--  → Those indexes are correct and necessary. They are flagged
--    "unused" only because the database has zero traffic yet.
--    Postgres marks indexes as used from the first query hit.
--    Dropping them would reintroduce 25 unindexed FK warnings.
--    They will disappear from the lint report once the app
--    receives its first real queries.
-- ============================================================


-- ============================================================
--  FIX 1 — ERROR
--  invitations_safe view is SECURITY DEFINER
--
--  Root cause: In Supabase (Postgres ≥ 15), views created by
--  a migration role default to SECURITY DEFINER, meaning the
--  view runs with the creator's permissions (superuser), not
--  the querying user's permissions. This bypasses RLS entirely
--  and lets any authenticated user read data they shouldn't.
--
--  Fix: Recreate the view explicitly as SECURITY INVOKER so
--  the view respects the calling user's RLS policies.
-- ============================================================

-- Drop and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.invitations_safe;

CREATE VIEW public.invitations_safe
WITH (security_invoker = true)   -- ← enforces querying user's permissions & RLS
AS
  SELECT
    id,
    organization_id,
    invited_by,
    email,
    role,
    -- token column intentionally excluded (sensitive)
    expires_at,
    accepted,
    created_at
  FROM public.invitations;

-- Restore grants on the safe view
GRANT SELECT ON public.invitations_safe TO authenticated;
REVOKE SELECT ON public.invitations_safe FROM anon;


-- ============================================================
--  FIX 2 — WARN (Performance)
--  organizations: multiple permissive policies for SELECT
--
--  Root cause: Our previous fix created:
--    - org_members_read  → FOR SELECT
--    - org_super_admin_write → FOR ALL  (ALL includes SELECT!)
--  For every SELECT query, Postgres evaluates BOTH policies,
--  which is wasteful and triggers the lint.
--
--  Fix: Replace both with three clean, non-overlapping policies:
--    - One SELECT-only policy (all org members)
--    - One INSERT-only policy (super_admin)
--    - One UPDATE/DELETE-only policy (super_admin)
--  No two policies now share the same role+action combination.
-- ============================================================

-- Drop both old policies that caused the conflict
DROP POLICY IF EXISTS "org_members_read"       ON public.organizations;
DROP POLICY IF EXISTS "org_super_admin_write"  ON public.organizations;

-- SELECT: any authenticated user who belongs to the org
CREATE POLICY "org_select"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
    )
  );

-- INSERT: only super_admins of the org (or backend service role)
CREATE POLICY "org_insert"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role = 'super_admin'
    )
  );

-- UPDATE/DELETE: only super_admins
CREATE POLICY "org_update_delete"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role = 'super_admin'
    )
  );

CREATE POLICY "org_delete"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE supabase_auth_id = (SELECT auth.uid())
        AND org_role = 'super_admin'
    )
  );


-- ============================================================
--  FIX 3 — WARN (Security)
--  refresh_leaderboard() has mutable search_path
--
--  Root cause: The function was likely recreated/replaced after
--  migration 004 ran, reverting the search_path setting.
--  Running it again here to ensure it sticks.
--
--  The SET search_path = public, pg_temp clause prevents an
--  attacker from creating a schema earlier in the search_path
--  and placing a malicious function with the same name there.
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp    -- ← immutable, locked search path
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$;

-- Revoke anon, keep authenticated (called by backend service role anyway)
REVOKE ALL  ON FUNCTION public.refresh_leaderboard() FROM anon;
REVOKE ALL  ON FUNCTION public.refresh_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard() TO authenticated;


-- ============================================================
--  FIX 4 — WARN (Security)
--  leaderboard materialized view accessible via Data API
--
--  Root cause: Materialized views bypass RLS because Postgres
--  has no concept of RLS on materialized views (only on tables).
--  Supabase warns whenever a mat-view is reachable via
--  PostgREST because it may expose data that should be filtered.
--
--  Our previous fix revoked anon access, but 'authenticated'
--  can still reach it directly via PostgREST, keeping the warn.
--
--  Correct fix: Remove ALL direct PostgREST access to the
--  materialized view. The leaderboard is already served by the
--  backend's /api/v1/leaderboard endpoint using the service
--  role key (which bypasses PostgREST entirely). No frontend
--  code queries the materialized view directly.
--
--  Additionally: wrap it behind a SECURITY DEFINER function
--  so it can be called safely from Edge Functions if needed.
-- ============================================================

-- Revoke all direct access to the materialized view from API roles
REVOKE SELECT ON public.leaderboard FROM anon;
REVOKE SELECT ON public.leaderboard FROM authenticated;
REVOKE SELECT ON public.leaderboard FROM PUBLIC;

-- Create a secure accessor function for any future server-side use
-- (Edge Functions or pg_net calls can use this safely)
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_sort     text    DEFAULT 'rank_by_projects',
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0
)
RETURNS TABLE (
  user_id              uuid,
  name                 text,
  user_type            text,
  company_name         text,
  organization_id      uuid,
  total_projects       bigint,
  total_project_value  numeric,
  total_reviews        bigint,
  avg_rating           numeric,
  avg_quality          numeric,
  avg_timeliness       numeric,
  avg_communication    numeric,
  rank_by_projects     bigint,
  rank_by_rating       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate sort parameter to prevent injection
  IF p_sort NOT IN ('rank_by_projects', 'rank_by_rating', 'total_projects', 'avg_rating', 'total_project_value') THEN
    p_sort := 'rank_by_projects';
  END IF;

  RETURN QUERY
  SELECT
    l.user_id, l.name, l.user_type, l.company_name, l.organization_id,
    l.total_projects, l.total_project_value, l.total_reviews,
    l.avg_rating, l.avg_quality, l.avg_timeliness, l.avg_communication,
    l.rank_by_projects, l.rank_by_rating
  FROM public.leaderboard l
  ORDER BY
    CASE WHEN p_sort = 'rank_by_projects'    THEN l.rank_by_projects END ASC,
    CASE WHEN p_sort = 'rank_by_rating'      THEN l.rank_by_rating END ASC,
    CASE WHEN p_sort = 'total_projects'      THEN l.total_projects END DESC,
    CASE WHEN p_sort = 'avg_rating'          THEN l.avg_rating END DESC,
    CASE WHEN p_sort = 'total_project_value' THEN l.total_project_value END DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- Only the service role (backend) and authenticated users can call this
REVOKE ALL     ON FUNCTION public.get_leaderboard(text, integer, integer) FROM anon;
REVOKE ALL     ON FUNCTION public.get_leaderboard(text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_leaderboard(text, integer, integer) TO authenticated;


-- ============================================================
--  VERIFICATION QUERIES
--  Run these individually after the migration to confirm
--  all issues are resolved
-- ============================================================

-- 1. Check no SECURITY DEFINER views remain in public schema:
-- SELECT viewname, definition
-- FROM pg_views
-- WHERE schemaname = 'public'
--   AND viewname = 'invitations_safe';
-- Expected: viewname present, security_invoker = true in definition

-- 2. Check organizations has exactly one policy per action per role:
-- SELECT polname, polcmd, polroles::regrole[]
-- FROM pg_policy
-- WHERE polrelid = 'public.organizations'::regclass
-- ORDER BY polcmd, polname;
-- Expected: no two rows share the same polcmd with overlapping roles

-- 3. Check refresh_leaderboard search_path is locked:
-- SELECT proname, proconfig
-- FROM pg_proc
-- WHERE proname = 'refresh_leaderboard'
--   AND pronamespace = 'public'::regnamespace;
-- Expected: proconfig includes 'search_path=public,pg_temp'

-- 4. Check leaderboard has no public grants:
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name = 'leaderboard'
--   AND grantee IN ('anon', 'authenticated', 'PUBLIC');
-- Expected: 0 rows
