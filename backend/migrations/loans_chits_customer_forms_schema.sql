-- Loan Request, Chit Fund, and Customer HR-form types.
--
-- Only correction from the supplied spec: customer_forms.customer_id referenced
-- a `customers` table that does not exist in this database — customers are rows
-- in `users` (role IN ('user','customer')), verified via schemaDef.js. Changed
-- to REFERENCES users(id). Everything else runs as written.
--
-- hub_forms is the only existing table touched, and only its form_type CHECK
-- constraint (dropped + re-added with the new values). All new tables use
-- IF NOT EXISTS.

ALTER TABLE hub_forms DROP CONSTRAINT IF EXISTS hub_forms_form_type_check;
ALTER TABLE hub_forms ADD CONSTRAINT hub_forms_form_type_check
CHECK (form_type IN (
  'leave_request','advance_request','expense_claim','complaint','suggestion',
  'asset_request','work_from_home','overtime_request','resignation',
  'loan_request','chit_fund_join','chit_bid_request',
  'customer_complaint','customer_feedback','customer_registration',
  'customer_visit_report','customer_credit_request',
  'other'
));

CREATE TABLE IF NOT EXISTS employee_loans (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  employee_id INTEGER REFERENCES users(id),
  hub_form_id INTEGER REFERENCES hub_forms(id),
  loan_amount NUMERIC(12,2) NOT NULL,
  purpose TEXT NOT NULL,
  repayment_months INTEGER NOT NULL,
  monthly_emi NUMERIC(10,2),
  interest_rate NUMERIC(5,2) DEFAULT 0,
  guarantor_name VARCHAR(200),
  guarantor_phone VARCHAR(20),
  guarantor_relation VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','active','closed')),
  approved_amount NUMERIC(12,2),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  disbursed_at TIMESTAMP,
  total_repaid NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES employee_loans(id),
  company_id INTEGER DEFAULT 1,
  employee_id INTEGER REFERENCES users(id),
  amount NUMERIC(10,2) NOT NULL,
  repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  repayment_mode VARCHAR(20) DEFAULT 'salary_deduction',
  recorded_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chit_groups (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  group_name VARCHAR(200) NOT NULL,
  chit_type VARCHAR(20) DEFAULT 'internal' CHECK (chit_type IN ('internal','external')),
  total_members INTEGER DEFAULT 0,
  monthly_amount NUMERIC(10,2) NOT NULL,
  duration_months INTEGER NOT NULL,
  total_chit_value NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  managed_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chit_memberships (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  chit_group_id INTEGER REFERENCES chit_groups(id),
  employee_id INTEGER REFERENCES users(id),
  hub_form_id INTEGER REFERENCES hub_forms(id),
  join_date DATE DEFAULT CURRENT_DATE,
  monthly_contribution NUMERIC(10,2),
  ticket_number INTEGER,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending','active','completed','withdrawn')),
  bid_amount NUMERIC(12,2),
  bid_month INTEGER,
  received_chit BOOLEAN DEFAULT false,
  received_amount NUMERIC(12,2),
  received_date DATE,
  total_paid NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_forms (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  form_type VARCHAR(30) NOT NULL,
  submitted_by INTEGER REFERENCES users(id),
  hub_form_id INTEGER REFERENCES hub_forms(id),
  customer_id INTEGER REFERENCES users(id),  -- corrected: no `customers` table; customers are users
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_gstin VARCHAR(20),
  form_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','converted','closed')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  resolution TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_employee ON employee_loans(employee_id, company_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON employee_loans(status, company_id);
CREATE INDEX IF NOT EXISTS idx_loan_rep ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_chit_group ON chit_memberships(chit_group_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_cust_forms ON customer_forms(company_id, form_type, status);
