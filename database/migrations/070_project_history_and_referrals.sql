-- ============================================================
--  Migration 070: Project edit history + User referral system
-- ============================================================

-- ─── 1. PROJECT EDIT HISTORY ──────────────────────────────────

CREATE TABLE IF NOT EXISTS project_edit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_peh_project ON project_edit_history(project_id, edited_at DESC);
CREATE INDEX idx_peh_user ON project_edit_history(user_id);

ALTER TABLE project_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_edit_history_own" ON project_edit_history
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())
  );

-- ─── 2. REFERRAL LINKS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_links_code ON referral_links(code);

ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_links_own" ON referral_links
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())
  );

-- ─── 3. REFERRAL DISCOUNTS (admin-assigned) ──────────────────

CREATE TABLE IF NOT EXISTS referral_discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  assigned_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_discounts_referrer ON referral_discounts(referrer_user_id, is_active);

ALTER TABLE referral_discounts ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage referral discounts
CREATE POLICY "referral_discounts_admin_manage" ON referral_discounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_auth_id = auth.uid() AND org_role = 'super_admin')
  );

-- ─── 4. REFERRAL SIGNUPS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  discount_applied BOOLEAN NOT NULL DEFAULT FALSE,
  discount_used_at TIMESTAMPTZ,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_signups_referrer ON referral_signups(referrer_user_id);
CREATE INDEX idx_referral_signups_referred ON referral_signups(referred_user_id);

ALTER TABLE referral_signups ENABLE ROW LEVEL SECURITY;

-- Referrer can see their own signups
CREATE POLICY "referral_signups_referrer" ON referral_signups
  FOR SELECT USING (
    referrer_user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())
  );

-- ─── 5. ADD referred_by TO users ─────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);

-- ─── 6. AUTO-CREATE REFERRAL LINK ON USER INSERT ─────────────

CREATE OR REPLACE FUNCTION create_referral_link_on_user_insert()
RETURNS trigger AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN := TRUE;
BEGIN
  WHILE code_exists LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM referral_links WHERE code = new_code) INTO code_exists;
  END LOOP;

  INSERT INTO referral_links (user_id, code)
  VALUES (NEW.id, new_code);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_referral_link ON users;
CREATE TRIGGER trg_create_referral_link
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_referral_link_on_user_insert();
