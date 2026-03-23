-- ============================================================
--  QSToolkit - BOQ, Invoices & Calculations Schema
--  Run AFTER 001_initial_schema.sql
-- ============================================================

-- ─── BOQ DOCUMENTS ────────────────────────────────────────────
CREATE TABLE boq_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Bill of Quantities',
  contract_no VARCHAR(100),
  client_name VARCHAR(255),
  location VARCHAR(255),
  prepared_by VARCHAR(255),
  checked_by VARCHAR(255),
  date_prepared DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  total_amount NUMERIC(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',     -- draft | final | submitted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BOQ SECTIONS ────────────────────────────────────────────
CREATE TABLE boq_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boq_id UUID REFERENCES boq_documents(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  section_total NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BOQ ITEMS ────────────────────────────────────────────────
CREATE TABLE boq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES boq_sections(id) ON DELETE CASCADE,
  boq_id UUID REFERENCES boq_documents(id) ON DELETE CASCADE,
  item_no VARCHAR(20),
  description TEXT NOT NULL,
  unit VARCHAR(30),
  quantity NUMERIC(12,3) DEFAULT 0,
  rate NUMERIC(12,2) DEFAULT 0,
  amount NUMERIC(18,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  remarks TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SAVED CALCULATIONS ───────────────────────────────────────
CREATE TABLE saved_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  calculator_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  inputs JSONB NOT NULL,
  outputs JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICES / QUOTATIONS ────────────────────────────────────
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  invoice_type VARCHAR(20) DEFAULT 'invoice',  -- invoice | quotation | proforma
  invoice_no VARCHAR(100),
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_address TEXT,
  client_phone VARCHAR(50),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  vat_percent NUMERIC(5,2) DEFAULT 7.5,       -- Nigerian VAT
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(18,2) DEFAULT 0,
  vat_amount NUMERIC(18,2) DEFAULT 0,
  discount_amount NUMERIC(18,2) DEFAULT 0,
  total_amount NUMERIC(18,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  status VARCHAR(30) DEFAULT 'draft',          -- draft | sent | paid | overdue | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICE LINE ITEMS ───────────────────────────────────────
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit VARCHAR(50),
  quantity NUMERIC(12,3) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  amount NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INT DEFAULT 0
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE boq_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boq_own" ON boq_documents
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "boq_sections_own" ON boq_sections
  FOR ALL USING (boq_id IN (SELECT id FROM boq_documents WHERE user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())));

CREATE POLICY "boq_items_own" ON boq_items
  FOR ALL USING (boq_id IN (SELECT id FROM boq_documents WHERE user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())));

CREATE POLICY "invoices_own" ON invoices
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "invoice_items_own" ON invoice_items
  FOR ALL USING (invoice_id IN (SELECT id FROM invoices WHERE user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid())));

CREATE POLICY "calcs_own" ON saved_calculations
  FOR ALL USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
