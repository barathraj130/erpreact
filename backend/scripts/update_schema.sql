-- backend/scripts/update_schema.sql

-- 1. Add Soft Delete Columns to Core Tables
DO $$ 
DECLARE 
    t TEXT;
    tables TEXT[] := ARRAY[
        'products', 'invoices', 'purchase_bills', 'purchase_bill_items', 
        'lenders', 'stock_units', 'ledger_groups', 'ledgers', 
        'transactions', 'cash_ledger', 'bank_ledger', 'users', 'employees'
    ];
BEGIN 
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
    END LOOP;
END $$;

-- 2. Create Files Table
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    original_name TEXT,
    stored_path TEXT,
    category TEXT,
    size_bytes BIGINT,
    mime_type TEXT,
    uploaded_by INTEGER,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Refresh Tokens Table (Ensuring schema matches routes)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked BOOLEAN DEFAULT false
);

-- 4. Audit Log System
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER,
    user_id INTEGER,
    action TEXT,
    table_name TEXT,
    record_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Trigger Function
CREATE OR REPLACE FUNCTION audit_log_changes() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
        COALESCE(NEW.company_id, OLD.company_id), 
        NULLIF(current_setting('app.current_user_id', true), '')::integer, 
        TG_OP, 
        TG_TABLE_NAME, 
        COALESCE(NEW.id, OLD.id), 
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END, 
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger to Invoices (Example)
DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
CREATE TRIGGER trg_audit_invoices 
AFTER INSERT OR UPDATE OR DELETE ON invoices 
FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Apply Trigger to Products
DROP TRIGGER IF EXISTS trg_audit_products ON products;
CREATE TRIGGER trg_audit_products 
AFTER INSERT OR UPDATE OR DELETE ON products 
FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
