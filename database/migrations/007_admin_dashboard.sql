-- ============================================================
--  Admin Dashboard Schema
-- ============================================================

-- IMPORTANT: TWO SEPARATE ADMIN HIERARCHIES (NO CONFLICTS)
-- 1. PLATFORM ADMINS: admin_users table (QSToolkit team)
--    - Global access to all users, subscriptions, analytics
--    - Roles: admin, super_admin
--    - Permissions: manage_promos, manage_users, send_notifications, view_analytics
-- 2. ORG ADMINS: org_role field in users table (Enterprise customers)
--    - Scoped to their organization only
--    - Roles: super_admin, admin, manager, member
--    - Can only manage their own organization members
-- These hierarchies are completely isolated and do not interfere.

-- ─── ADMIN USERS (Platform-level admins separate from org admins) ──
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  admin_role VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'admin' | 'super_admin'
  permissions JSONB DEFAULT '[]'::jsonb,  -- granular permissions array
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow only super_admins to create other admins
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ─── ADMIN ACTIVITY LOG ───────────────────────────────────────
CREATE TABLE admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,  -- 'created_promo', 'deleted_user', etc.
  resource_type VARCHAR(50),      -- 'promo_code', 'user', 'subscription'
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PUSH NOTIFICATION SUBSCRIPTIONS ──────────────────────────
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  auth_key VARCHAR(255) NOT NULL,
  p256dh_key VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ─── PUSH NOTIFICATION CAMPAIGNS ──────────────────────────────
CREATE TABLE push_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  action_url TEXT,
  target_segment VARCHAR(50), -- 'all', 'free', 'paid', 'student', 'pro'
  scheduled_for TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'scheduled' | 'sent' | 'cancelled'
  sent_at TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  successful_sends INT DEFAULT 0,
  failed_sends INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATION DELIVERY TRACKING ───────────────────────────
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES push_notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXTEND PROMO CODES TABLE (add tracking fields) ────────────
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS
  status VARCHAR(20) DEFAULT 'active'; -- active | inactive | archived

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS
  discount_type VARCHAR(20) DEFAULT 'percent'; -- percent | fixed_amount

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS
  fixed_amount NUMERIC(10,2); -- for fixed discount amounts

-- ─── PLATFORM STATISTICS ─────────────────────────────────────
CREATE TABLE platform_stats (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_users INT DEFAULT 0,
  active_subscriptions INT DEFAULT 0,
  total_revenue NUMERIC(18,2) DEFAULT 0,
  new_signups INT DEFAULT 0,
  churn_users INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stat_date)
);

-- ─── INDEXES FOR PERFORMANCE ──────────────────────────────────
CREATE INDEX idx_admin_users_admin_role ON admin_users(admin_role);
CREATE INDEX idx_admin_activity_logs_admin_user_id ON admin_activity_logs(admin_user_id);
CREATE INDEX idx_admin_activity_logs_created_at ON admin_activity_logs(created_at);
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_notification_deliveries_user_id ON notification_deliveries(user_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_platform_stats_stat_date ON platform_stats(stat_date DESC);
