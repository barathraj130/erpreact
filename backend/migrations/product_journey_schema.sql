-- Product Journey ID tracking system — NEW TABLES ONLY.
-- Does not touch any existing table. Safe to run multiple times (IF NOT EXISTS).
--
-- Two corrections from the original spec, based on this database's real schema
-- (confirmed via information_schema, not guessed):
--   1. There is no `customers` table — customers are rows in `users`
--      (role IN ('user','customer')). customer_id now references users(id).
--   2. Everything else in the spec's SQL (branches, suppliers, products,
--      purchase_bills FKs) matched the real schema as written — no other
--      changes needed here. (The branches.name / inventory.quantity
--      mismatches only affected the *route file*, not this schema.)

CREATE TABLE IF NOT EXISTS product_journeys (
  id SERIAL PRIMARY KEY,
  journey_id VARCHAR(50) UNIQUE NOT NULL,
  company_id INTEGER DEFAULT 1,
  product_id INTEGER REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL,
  product_code VARCHAR(50),
  purchase_bill_id INTEGER REFERENCES purchase_bills(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  supplier_name VARCHAR(200),
  purchase_date DATE NOT NULL,
  purchase_rate NUMERIC(10,2) DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  fresh_purchased INTEGER DEFAULT 0,
  mistake_purchased INTEGER DEFAULT 0,
  branch_id INTEGER REFERENCES branches(id),
  batch_number INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','partial','exhausted','closed')),
  fresh_remaining INTEGER DEFAULT 0,
  mistake_remaining INTEGER DEFAULT 0,
  total_sold INTEGER DEFAULT 0,
  fresh_sold INTEGER DEFAULT 0,
  mistake_sold INTEGER DEFAULT 0,
  total_returned INTEGER DEFAULT 0,
  fresh_returned INTEGER DEFAULT 0,
  mistake_returned INTEGER DEFAULT 0,
  total_converted_to_fresh INTEGER DEFAULT 0,
  total_revenue NUMERIC(14,2) DEFAULT 0,
  fresh_revenue NUMERIC(14,2) DEFAULT 0,
  mistake_revenue NUMERIC(14,2) DEFAULT 0,
  total_purchase_cost NUMERIC(14,2) DEFAULT 0,
  total_conversion_cost NUMERIC(14,2) DEFAULT 0,
  gross_profit NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_journey_events (
  id SERIAL PRIMARY KEY,
  journey_id INTEGER REFERENCES product_journeys(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'purchased',
    'inventory_added',
    'fresh_sold',
    'mistake_sold',
    'customer_return_fresh',
    'customer_return_mistake',
    'fresh_resold',
    'mistake_resold',
    'mistake_to_fresh',
    'branch_transfer_out',
    'branch_transfer_in',
    'supplier_return',
    'adjustment'
  )),
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity INTEGER NOT NULL DEFAULT 0,
  rate NUMERIC(10,2) DEFAULT 0,
  total_value NUMERIC(12,2) DEFAULT 0,
  stock_type VARCHAR(10) DEFAULT 'fresh'
    CHECK (stock_type IN ('fresh','mistake')),
  reference_type VARCHAR(30),
  reference_id INTEGER,
  reference_number VARCHAR(50),
  -- corrected: no `customers` table in this database — customers are users
  customer_id INTEGER REFERENCES users(id),
  customer_name VARCHAR(200),
  supplier_id INTEGER REFERENCES suppliers(id),
  supplier_name VARCHAR(200),
  branch_id INTEGER REFERENCES branches(id),
  branch_name VARCHAR(200),
  from_branch_id INTEGER REFERENCES branches(id),
  to_branch_id INTEGER REFERENCES branches(id),
  running_fresh_balance INTEGER DEFAULT 0,
  running_mistake_balance INTEGER DEFAULT 0,
  description TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mistake_to_fresh_conversions (
  id SERIAL PRIMARY KEY,
  journey_id INTEGER REFERENCES product_journeys(id),
  product_id INTEGER REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  company_id INTEGER DEFAULT 1,
  conversion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_converted INTEGER NOT NULL,
  conversion_type VARCHAR(20) DEFAULT 'other'
    CHECK (conversion_type IN (
      'repair',
      're_inspection',
      'processing',
      'other'
    )),
  reason TEXT NOT NULL,
  before_mistake_qty INTEGER DEFAULT 0,
  after_mistake_qty INTEGER DEFAULT 0,
  before_fresh_qty INTEGER DEFAULT 0,
  after_fresh_qty INTEGER DEFAULT 0,
  conversion_cost NUMERIC(10,2) DEFAULT 0,
  converted_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pj_company ON product_journeys(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pj_purchase ON product_journeys(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_pj_product ON product_journeys(product_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_pje_journey ON product_journey_events(journey_id, event_date);
CREATE INDEX IF NOT EXISTS idx_pje_type ON product_journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pje_customer ON product_journey_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_pje_reference ON product_journey_events(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_mtf_journey ON mistake_to_fresh_conversions(journey_id);
CREATE INDEX IF NOT EXISTS idx_mtf_product ON mistake_to_fresh_conversions(product_id, conversion_date);
CREATE INDEX IF NOT EXISTS idx_mtf_branch ON mistake_to_fresh_conversions(branch_id, company_id);
