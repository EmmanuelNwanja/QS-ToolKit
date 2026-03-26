-- ============================================================
--  QSToolkit - Fix Leaderboard to Count Non-Cancelled Projects
--  Previously only counted projects with status = 'completed'.
--  Now counts all projects that are not cancelled.
-- ============================================================

-- Drop old index first (depends on the view)
DROP INDEX IF EXISTS leaderboard_user_idx;

-- Drop and rebuild the materialized view
DROP MATERIALIZED VIEW IF EXISTS public.leaderboard CASCADE;

CREATE MATERIALIZED VIEW public.leaderboard AS
SELECT
  u.id AS user_id,
  u.name,
  u.user_type,
  u.company_name,
  u.organization_id,
  COUNT(DISTINCT p.id) AS total_projects,
  COALESCE(SUM(p.final_value), 0) AS total_project_value,
  COUNT(DISTINCT fr.id) AS total_reviews,
  COALESCE(AVG(fr.rating), 0)::NUMERIC(3,1) AS avg_rating,
  COALESCE(AVG(fr.quality_score), 0)::NUMERIC(3,1) AS avg_quality,
  COALESCE(AVG(fr.timeliness_score), 0)::NUMERIC(3,1) AS avg_timeliness,
  COALESCE(AVG(fr.communication_score), 0)::NUMERIC(3,1) AS avg_communication,
  RANK() OVER (ORDER BY COUNT(DISTINCT p.id) DESC, COALESCE(AVG(fr.rating), 0) DESC) AS rank_by_projects,
  RANK() OVER (ORDER BY COALESCE(AVG(fr.rating), 0) DESC, COUNT(DISTINCT p.id) DESC) AS rank_by_rating
FROM users u
LEFT JOIN projects p ON p.user_id = u.id AND p.status NOT IN ('cancelled')
LEFT JOIN feedback_links fl ON fl.user_id = u.id
LEFT JOIN feedback_responses fr ON fr.feedback_link_id = fl.id
WHERE u.user_type IN ('professional', 'company')
GROUP BY u.id, u.name, u.user_type, u.company_name, u.organization_id;

-- Restore the unique index
CREATE UNIQUE INDEX leaderboard_user_idx ON public.leaderboard (user_id);

-- Recreate the refresh function (may already exist, but redefine to be safe)
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$ LANGUAGE plpgsql;
