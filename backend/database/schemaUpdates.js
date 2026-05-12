// backend/database/schemaUpdates.js
import * as db from "./pg.js";

export const runSchemaUpdates = async () => {
    console.log("🚀 Running Schema Updates...");
    
    try {
        // 1. Update products table
        await db.pgRun(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS category VARCHAR(100),
            ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC(12,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS location VARCHAR(255);
        `);

        // 2. Create inventory table
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                branch_id INTEGER,
                product_id INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                product_name TEXT,
                sku TEXT,
                unit TEXT,
                current_stock NUMERIC(12,2) DEFAULT 0,
                min_stock_level NUMERIC(12,2) DEFAULT 0,
                max_stock_level NUMERIC(12,2) DEFAULT 0,
                cost_price NUMERIC(12,2) DEFAULT 0,
                selling_price NUMERIC(12,2) DEFAULT 0,
                hsn_code TEXT,
                gst_percent NUMERIC(5,2),
                category VARCHAR(100),
                location TEXT,
                last_updated TIMESTAMP DEFAULT NOW()
            );
        `);

        // 3. Create inventory_movements table
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                branch_id INTEGER,
                product_id INTEGER REFERENCES products(id),
                type VARCHAR(50) NOT NULL, -- Opening Stock, Purchase, Sales, Adjustment, Return
                qty_in NUMERIC(12,2) DEFAULT 0,
                qty_out NUMERIC(12,2) DEFAULT 0,
                reference_type VARCHAR(50), -- product_creation, purchase_bill, invoice, manual_adjustment
                reference_id INTEGER,
                note TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 4. Update purchase_bills table
        await db.pgRun(`
            ALTER TABLE purchase_bills 
            ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;
        `);

        // 5. Update branches table — add all extended columns
        await db.pgRun(`
            ALTER TABLE branches
            ADD COLUMN IF NOT EXISTS branch_type VARCHAR(50) DEFAULT 'Sub Branch',
            ADD COLUMN IF NOT EXISTS address_line1 TEXT,
            ADD COLUMN IF NOT EXISTS address_line2 TEXT,
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
            ADD COLUMN IF NOT EXISTS state VARCHAR(100),
            ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
            ADD COLUMN IF NOT EXISTS branch_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS branch_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS manager_whatsapp VARCHAR(50),
            ADD COLUMN IF NOT EXISTS manager_user_id INTEGER,
            ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
            ADD COLUMN IF NOT EXISTS bill_prefix VARCHAR(20),
            ADD COLUMN IF NOT EXISTS bill_sequence INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS default_payment_mode VARCHAR(50) DEFAULT 'Cash',
            ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC(15,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS city_pincode TEXT;
        `);

        // 6. Create daily_ledger_closings table
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS daily_ledger_closings (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                closing_date DATE NOT NULL,
                ledger_type VARCHAR(20) NOT NULL, -- 'CASH' or 'BANK'
                bank_account_id INTEGER,
                closing_balance NUMERIC(15,2) DEFAULT 0,
                closed_by INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(company_id, branch_id, closing_date, ledger_type, bank_account_id)
            );
        `);

        // 7. Create payment_qr_codes table
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS payment_qr_codes (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                label VARCHAR(100) NOT NULL,
                upi_id VARCHAR(100),
                image_url TEXT,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 8. Create company_bank_accounts table
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS company_bank_accounts (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                bank_name VARCHAR(100) NOT NULL,
                account_number VARCHAR(100) NOT NULL,
                ifsc_code VARCHAR(50),
                account_type VARCHAR(50) DEFAULT 'Current',
                holder_name VARCHAR(100),
                display_name VARCHAR(100),
                upi_id VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 9. Fix Products, Users, and Purchase Bills
        await db.pgRun(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS meta JSONB;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS bill_category VARCHAR(50);
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS tax_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS sub_total NUMERIC(15,2) DEFAULT 0;
        `);

        // 10. Create Stock Requests and Branch Inventory
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS stock_requests (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                from_branch_id INTEGER,
                to_branch_id INTEGER,
                product_id INTEGER,
                requested_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
                quantity NUMERIC(12,2) DEFAULT 0,
                urgency VARCHAR(20) DEFAULT 'Normal',
                status VARCHAR(50) DEFAULT 'PENDING',
                requested_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS branch_inventory (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                current_stock NUMERIC(12,2) DEFAULT 0,
                UNIQUE(branch_id, product_id)
            );
            CREATE TABLE IF NOT EXISTS stock_transfers (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                from_branch_id INTEGER,
                to_branch_id INTEGER,
                product_id INTEGER,
                qty NUMERIC(15,3) NOT NULL,
                transferred_by INTEGER,
                transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                reference_type VARCHAR(50),
                reference_id INTEGER
            );
        `);

        // Force add columns if table already existed
        await db.pgRun(`
            ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_qty NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'Normal';
            ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT NOW();

            -- Fix branch_inventory: add missing last_updated column
            ALTER TABLE branch_inventory ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();
            
            -- Invoices: all extended columns used by invoiceRoutes.js INSERT
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS financial_month VARCHAR(20);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sub_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20) DEFAULT 'INTRA_STATE';
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS return_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bundles_count INTEGER DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transportation_mode VARCHAR(50);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS date_of_supply DATE;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reverse_charge VARCHAR(10) DEFAULT 'No';
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS broker_id INTEGER;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS broker_commission_rate NUMERIC(5,2);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

            -- Invoice Line Items: all columns used by invoiceRoutes.js
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id);
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;

            ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ledger_id INTEGER;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lender_id INTEGER;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS agreement_id INTEGER;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS related_invoice_id INTEGER;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id INTEGER;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date DATE;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS proof_url TEXT;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_ref_no VARCHAR(100);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_category VARCHAR(100);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id INTEGER;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS date DATE; -- Some routes use 'date', some use 'transaction_date'
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category VARCHAR(100);
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS meta JSONB; -- Required by customerLedgerService.js
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success';

            -- Attendance unique constraint for ON CONFLICT
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_emp_date_unique') THEN
                    ALTER TABLE attendance ADD CONSTRAINT attendance_emp_date_unique UNIQUE (employee_id, date);
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS payroll_runs (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                month_year VARCHAR(10) NOT NULL,
                base_salary NUMERIC(15,2) DEFAULT 0,
                attendance_days NUMERIC(5,2) DEFAULT 0,
                gross_earnings NUMERIC(15,2) DEFAULT 0,
                total_deductions NUMERIC(15,2) DEFAULT 0,
                advance_deduction NUMERIC(15,2) DEFAULT 0,
                net_pay NUMERIC(15,2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'PAID',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS transaction_lines (
                id SERIAL PRIMARY KEY,
                transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                account_id INTEGER NOT NULL REFERENCES ledgers(id),
                debit_amount NUMERIC(15,2) DEFAULT 0,
                credit_amount NUMERIC(15,2) DEFAULT 0,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            -- Drop the FK on transaction_lines.account_id entirely
            -- This allows both chart_of_accounts IDs and ledgers IDs to be inserted
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_lines_account_id_fkey') THEN
                    ALTER TABLE transaction_lines DROP CONSTRAINT transaction_lines_account_id_fkey;
                END IF;
            END $$;

            ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS source VARCHAR(100);
            ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS reference_id INTEGER;
            ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS date DATE;
            
            ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS source VARCHAR(100);
            ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS reference_id INTEGER;
            ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS bank_account_id INTEGER;
            ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS date DATE;

            ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

            ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_id INTEGER;
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS party_name VARCHAR(255);
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS party_type VARCHAR(50);
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_direction VARCHAR(50);
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(15,2);
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_type VARCHAR(20);
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS duration_months INTEGER;
            ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_cycle VARCHAR(50);
            
            ALTER TABLE lenders ADD COLUMN IF NOT EXISTS type VARCHAR(50);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_lenders_name_company ON lenders(lender_name, company_id);
        `);

        console.log("✅ Schema Updates Completed.");
    } catch (err) {
        console.error("❌ Schema Update Error:", err);
    }
};