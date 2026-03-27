-- ============================================================
--  QSToolkit - Migration 017: Leaderboard Aggregation Fix
--  Prevent total_project_value inflation caused by joining
--  projects and feedback rows in the same aggregate query.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.leaderboard CASCADE;

CREATE MATERIALIZED VIEW public.leaderboard AS
WITH project_totals AS (
  SELECT
    p.user_id,
    COUNT(*) AS total_projects,
    COALESCE(SUM(COALESCE(p.final_value, p.estimated_value, 0)), 0) AS total_project_value
  FROM projects p
  WHERE p.status NOT IN ('cancelled')
  GROUP BY p.user_id
),
feedback_totals AS (
  SELECT
    fl.user_id,
    COUNT(fr.id) AS total_reviews,
    COALESCE(AVG(fr.rating), 0)::NUMERIC(3,1) AS avg_rating,
    COALESCE(AVG(fr.quality_score), 0)::NUMERIC(3,1) AS avg_quality,
    COALESCE(AVG(fr.timeliness_score), 0)::NUMERIC(3,1) AS avg_timeliness,
    COALESCE(AVG(fr.communication_score), 0)::NUMERIC(3,1) AS avg_communication
  FROM feedback_links fl
  LEFT JOIN feedback_responses fr ON fr.feedback_link_id = fl.id
  GROUP BY fl.user_id
)
SELECT
  u.id AS user_id,
  'QS-' || UPPER(SUBSTRING(u.id::text, 1, 8)) AS public_id,
  u.user_type,
  u.organization_id,
  COALESCE(pt.total_projects, 0) AS total_projects,
  COALESCE(pt.total_project_value, 0) AS total_project_value,
  COALESCE(ft.total_reviews, 0) AS total_reviews,
  COALESCE(ft.avg_rating, 0)::NUMERIC(3,1) AS avg_rating,
  COALESCE(ft.avg_quality, 0)::NUMERIC(3,1) AS avg_quality,
  COALESCE(ft.avg_timeliness, 0)::NUMERIC(3,1) AS avg_timeliness,
  COALESCE(ft.avg_communication, 0)::NUMERIC(3,1) AS avg_communication,
  RANK() OVER (
    ORDER BY COALESCE(pt.total_projects, 0) DESC, COALESCE(ft.avg_rating, 0) DESC
  ) AS rank_by_projects,
  RANK() OVER (
    ORDER BY COALESCE(ft.avg_rating, 0) DESC, COALESCE(pt.total_projects, 0) DESC
  ) AS rank_by_rating
FROM users u
LEFT JOIN project_totals pt ON pt.user_id = u.id
LEFT JOIN feedback_totals ft ON ft.user_id = u.id
WHERE u.user_type IN ('student', 'professional', 'company');

CREATE UNIQUE INDEX leaderboard_user_idx ON public.leaderboard (user_id);

CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$ LANGUAGE plpgsql;
