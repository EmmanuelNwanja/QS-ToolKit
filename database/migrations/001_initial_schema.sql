-- ============================================================
--  QSToolkit - Initial Schema
--  Run this in your Supabase SQL Editor (in order)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── SUBSCRIPTION PLANS ───────────────────────────────────────
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,  -- 'student' | 'pro' | 'enterprise'
  price_monthly NUMERIC(12,2) NOT NULL,
  max_projects INT NOT NULL,
  max_calculator_uses INT,    -- NULL = unlimited
  max_users INT NOT NULL DEFAULT 1,
  max_devices INT NOT NULL DEFAULT 1,
  has_invoice_maker BOOLEAN DEFAULT FALSE,
  has_pdf_export BOOLEAN DEFAULT FALSE,
  has_excel_export BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans (name, price_monthly, max_projects, max_calculator_uses, max_users, max_devices, has_invoice_maker, has_pdf_export, has_excel_export)
VALUES
  ('free',       0,      0,   1,   1,  1, FALSE, FALSE, FALSE),
  ('student',    5,      7,   7,   1,  1, FALSE, FALSE, FALSE),
  ('pro',     15000,    15,  20,   1,  2, TRUE,  TRUE,  TRUE),
  ('enterprise',70000, 200, NULL,  5, 15, TRUE,  TRUE,  TRUE);

-- ─── ORGANIZATIONS ────────────────────────────────────────────
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  official_email VARCHAR(255),
  business_reg_no VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_auth_id UUID UNIQUE,              -- links to Supabase Auth
  user_type VARCHAR(30) NOT NULL DEFAULT 'student', -- student | professional | company
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password_hash VARCHAR(255),               -- for email/password auth
  google_id VARCHAR(255),
  university_name VARCHAR(255),             -- for students
  company_name VARCHAR(255),
  qs_cert_no VARCHAR(100),
  company_address TEXT,
  organization_id UUID REFERENCES organizations(id),
  org_role VARCHAR(30) DEFAULT 'member',    -- super_admin | admin | manager | member
  plan_id UUID REFERENCES subscription_plans(id),
  subscription_status VARCHAR(30) DEFAULT 'inactive', -- active | inactive | trial
  subscription_expires_at TIMESTAMPTZ,
  paystack_customer_id VARCHAR(100),
  paystack_subscription_code VARCHAR(100),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BRANDING SETTINGS ────────────────────────────────────────
CREATE TABLE branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  logo_url TEXT,
  brand_name VARCHAR(255),
  company_details TEXT,
  contact_info TEXT,
  signature_url TEXT,
  primary_color VARCHAR(10) DEFAULT '#1a3c5e',
  secondary_color VARCHAR(10) DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEVICE SESSIONS ─────────────────────────────────────────
CREATE TABLE device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FREE TRIAL USAGE (IP/device gate for unregistered users) ─
CREATE TABLE free_trial_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address VARCHAR(50) NOT NULL,
  device_fingerprint VARCHAR(255),
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ip_address)
);

-- ─── CALCULATOR USAGE TRACKER ────────────────────────────────
CREATE TABLE calculator_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  calculator_type VARCHAR(50) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROJECTS ─────────────────────────────────────────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  title VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  project_type VARCHAR(100),               -- residential | commercial | industrial | infrastructure
  location VARCHAR(255),
  state VARCHAR(100),
  description TEXT,
  start_date DATE,
  end_date DATE,
  estimated_value NUMERIC(18,2),
  final_value NUMERIC(18,2),
  status VARCHAR(50) DEFAULT 'active',     -- active | completed | on_hold | cancelled
  is_verified BOOLEAN DEFAULT FALSE,       -- verified by Admin
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVITATIONS ─────────────────────────────────────────────
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(30) DEFAULT 'member',
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_usage ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own record
CREATE POLICY "users_own" ON users
  FOR ALL USING (supabase_auth_id = auth.uid());

-- Projects: user sees own projects or org projects
CREATE POLICY "projects_own" ON projects
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- Branding: own only
CREATE POLICY "branding_own" ON branding_settings
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

-- Calculator usage: own only
CREATE POLICY "calc_own" ON calculator_usage
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
