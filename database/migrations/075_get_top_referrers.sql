-- ═══════════════════════════════════════════════════════════════
-- Migration 075: get_top_referrers RPC
-- ═══════════════════════════════════════════════════════════════
-- Root-cause fix for the 2026-09-19 production incident:
-- adminGetReferralStats called supabase.rpc('get_top_referrers') but the
-- function was never created in any migration → PostgREST PGRST202 on every
-- call. (The endpoint is now also hardened against null legs regardless.)
--
-- Returns the referrers with the most signups, joined to user identity.
-- SECURITY DEFINER so the service-role backend call needs no per-user RLS
-- traversal; restricted to search_path to avoid injection surfaces.

CREATE OR REPLACE FUNCTION public.get_top_referrers(limit_count INT DEFAULT 5)
RETURNS TABLE (
  referrer_user_id UUID,
  referrer_name    TEXT,
  referrer_email   TEXT,
  referral_code    TEXT,
  total_signups    BIGINT,
  conversions      BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rs.referrer_user_id,
    u.name  AS referrer_name,
    u.email AS referrer_email,
    rl.code AS referral_code,
    COUNT(*)                          AS total_signups,
    COUNT(*) FILTER (WHERE rs.discount_applied) AS conversions
  FROM referral_signups rs
  JOIN users u ON u.id = rs.referrer_user_id
  LEFT JOIN referral_links rl ON rl.user_id = rs.referrer_user_id
  GROUP BY rs.referrer_user_id, u.name, u.email, rl.code
  ORDER BY total_signups DESC, conversions DESC
  LIMIT GREATEST(LEAST(COALESCE(limit_count, 5), 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_referrers(INT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_top_referrers(INT) FROM anon, authenticated;
