-- Migration 046: Fix RLS auth.uid() mismatches in exam_search_logs and academy_modules
-- The backend uses service role key, so these are defense-in-depth fixes for future-proofing

-- Fix exam_search_logs INSERT policy: auth.uid() is the Supabase auth UUID,
-- but user_id stores the internal users.id. The correct comparison uses supabase_auth_id.
DROP POLICY IF EXISTS "exam_search_logs_insert_own" ON exam_search_logs;
CREATE POLICY "exam_search_logs_insert_own" ON exam_search_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND id = user_id)
  );

-- Fix exam_search_logs admin SELECT policy: same auth.uid() mismatch
DROP POLICY IF EXISTS "exam_search_logs_read_admin" ON exam_search_logs;
CREATE POLICY "exam_search_logs_read_admin" ON exam_search_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
  );

-- Add user SELECT policy for exam_search_logs (users should read their own search history)
DROP POLICY IF EXISTS "exam_search_logs_read_own" ON exam_search_logs;
CREATE POLICY "exam_search_logs_read_own" ON exam_search_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND id = user_id)
  );

-- Fix academy_modules admin policy: same auth.uid() mismatch
DROP POLICY IF EXISTS "academy_modules_manage_admin" ON academy_modules;
CREATE POLICY "academy_modules_manage_admin" ON academy_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
  );

-- Add write policy for academy_contest_questions (only contest creators/admins should insert)
-- Currently only has SELECT: public. Contest question creation is done via service role, but
-- this adds defense-in-depth for future client-side access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'academy_contest_questions' AND policyname = 'academy_contest_questions_insert_creator'
  ) THEN
    CREATE POLICY "academy_contest_questions_insert_creator" ON academy_contest_questions
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM academy_contests c
          JOIN users u ON u.supabase_auth_id = auth.uid()
          WHERE c.id = contest_id AND (c.creator_id = u.id OR u.org_role = 'super_admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'academy_contest_questions' AND policyname = 'academy_contest_questions_update_creator'
  ) THEN
    CREATE POLICY "academy_contest_questions_update_creator" ON academy_contest_questions
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM academy_contests c
          JOIN users u ON u.supabase_auth_id = auth.uid()
          WHERE c.id = contest_id AND (c.creator_id = u.id OR u.org_role = 'super_admin')
        )
      );
  END IF;
END $$;

-- Add INSERT policy for academy_tokens (awards are service-role, but defense-in-depth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'academy_tokens' AND policyname = 'academy_tokens_insert_admin'
  ) THEN
    CREATE POLICY "academy_tokens_insert_admin" ON academy_tokens
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
      );
  END IF;
END $$;
