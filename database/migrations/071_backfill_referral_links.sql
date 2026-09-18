-- ============================================================
--  Migration 071: Backfill referral_links for existing users
-- ============================================================

-- Generate referral links for all users who don't have one yet.
-- The trigger from migration 070 only fires on NEW inserts,
-- so every pre-existing user is missing a referral_links row.

INSERT INTO referral_links (user_id, code)
SELECT
  u.id,
  upper(substring(md5(u.id::text || random()::text) from 1 for 8))
FROM users u
LEFT JOIN referral_links rl ON rl.user_id = u.id
WHERE rl.id IS NULL;

-- Verify coverage
DO $$
BEGIN
  RAISE NOTICE 'Backfilled % referral links', (SELECT count(*) FROM referral_links);
END $$;
