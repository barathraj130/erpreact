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
        `);

        // Force add columns if table already existed
        await db.pgRun(`
            ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_qty NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'Normal';
            ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT NOW();
            
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
            ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bill_purpose VARCHAR(50) DEFAULT 'real';
        `);

        console.log("✅ Schema Updates Completed.");
    } catch (err) {
        console.error("❌ Schema Update Error:", err);
    }
};