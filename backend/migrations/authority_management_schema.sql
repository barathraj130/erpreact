-- Role & Authority Management — NEW TABLE ONLY. Does not touch any existing
-- table. Safe to run multiple times (IF NOT EXISTS). FK targets (users.id,
-- branches.id) verified against schemaDef.js — no corrections needed.

CREATE TABLE IF NOT EXISTS authority_roles (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_decision_maker BOOLEAN DEFAULT false,
  display_title VARCHAR(100),
  can_approve_leave BOOLEAN DEFAULT false,
  can_approve_advance BOOLEAN DEFAULT false,
  can_approve_expense BOOLEAN DEFAULT false,
  can_approve_attendance BOOLEAN DEFAULT false,
  can_approve_complaint BOOLEAN DEFAULT false,
  can_approve_wfh BOOLEAN DEFAULT false,
  can_approve_overtime BOOLEAN DEFAULT false,
  can_approve_purchase BOOLEAN DEFAULT false,
  can_approve_asset BOOLEAN DEFAULT false,
  can_approve_suggestion BOOLEAN DEFAULT false,
  scope VARCHAR(20) DEFAULT 'company'
    CHECK (scope IN ('company','branch','team')),
  scope_branch_id INTEGER REFERENCES branches(id),
  is_active BOOLEAN DEFAULT true,
  set_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_company ON authority_roles(company_id, is_decision_maker);
CREATE INDEX IF NOT EXISTS idx_auth_user ON authority_roles(user_id);
