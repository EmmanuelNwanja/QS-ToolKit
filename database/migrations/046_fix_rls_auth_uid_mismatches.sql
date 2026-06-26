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
