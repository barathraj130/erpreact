// backend/database/schemaUpdates.js
import * as db from "./pg.js";

export const runSchemaUpdates = async () => {
    console.log("🚀 Running Schema Updates...");

    // ── Critical standalone migrations (each isolated — never blocks others) ──
    // customer_points table — required by pointsService / invoiceRoutes
    await db.query(`
        CREATE TABLE IF NOT EXISTS customer_points (
            id               SERIAL PRIMARY KEY,
            customer_id      INTEGER NOT NULL,
            transaction_type VARCHAR(20) NOT NULL,
            points           INTEGER NOT NULL,
            reference_id     INTEGER,
            description      TEXT,
            balance_after    INTEGER NOT NULL DEFAULT 0,
            expires_at       TIMESTAMP,
            created_at       TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    // invoice_id on cash/bank ledger — enables cleanup when an invoice is deleted
    await db.query(`ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS invoice_id INTEGER`).catch(() => {});
    await db.query(`ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS invoice_id INTEGER`).catch(() => {});

    // ── One-time cleanup: remove excess orphaned payment entries ──────────────
    // Problem: when an invoice is deleted its invoice_payments are removed but
    // the cash/bank ledger rows (created before invoice_id was tracked) remain.
    // If two invoices had the same amount on the same date, a simple NOT EXISTS
    // check keeps all rows. Instead we count how many active invoice_payments
    // exist for each (company, amount, date, method) group and delete the
    // excess older rows (lowest IDs = oldest = from the deleted invoice).
    await db.query(`
        DELETE FROM cash_ledger
        WHERE id IN (
            SELECT id FROM (
                SELECT
                    cl.id,
                    ROW_NUMBER() OVER (
                        PARTITION BY cl.company_id, cl.amount, cl.date::date
                        ORDER BY cl.id DESC           -- keep newest (real), delete oldest (ghost)
                    ) AS rn,
                    (
                        SELECT COUNT(*)
                        FROM invoice_payments ip
                        JOIN invoices i ON i.id = ip.invoice_id
                        WHERE UPPER(COALESCE(ip.payment_method,'')) = 'CASH'
                          AND ip.amount              = cl.amount
                          AND ip.payment_date::date  = cl.date::date
                          AND i.company_id           = cl.company_id
                          AND COALESCE(i.is_deleted, false) = false
                    ) AS active_count
                FROM cash_ledger cl
                WHERE cl.source = 'payment' AND cl.invoice_id IS NULL
            ) ranked
            WHERE rn > active_count
        )
    `).catch(() => {});

    await db.query(`
        DELETE FROM bank_ledger
        WHERE id IN (
            SELECT id FROM (
                SELECT
                    bl.id,
                    ROW_NUMBER() OVER (
                        PARTITION BY bl.company_id, bl.amount, bl.date::date
                        ORDER BY bl.id DESC
                    ) AS rn,
                    (
                        SELECT COUNT(*)
                        FROM invoice_payments ip
                        JOIN invoices i ON i.id = ip.invoice_id
                        WHERE UPPER(COALESCE(ip.payment_method,'')) IN ('BANK','UPI')
                          AND ip.amount              = bl.amount
                          AND ip.payment_date::date  = bl.date::date
                          AND i.company_id           = bl.company_id
                          AND COALESCE(i.is_deleted, false) = false
                    ) AS active_count
                FROM bank_ledger bl
                WHERE bl.source = 'payment' AND bl.invoice_id IS NULL
            ) ranked
            WHERE rn > active_count
        )
    `).catch(() => {});

    // Invoice columns (points & series numbering)
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS points_earned    INTEGER        DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS points_redeemed  INTEGER        DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS points_discount  NUMERIC(10,2)  DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_prefix    VARCHAR(10)`).catch(() => {});
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_number    INTEGER        DEFAULT 0`).catch(() => {});

    // ── Drop ALL old unique constraints on invoice_number — runs on EVERY startup ──
    // Must live OUTSIDE the big try/catch so an earlier failure cannot skip these.
    await db.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key`).catch(() => {});
    await db.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_invoice_number_key`).catch(() => {});
    await db.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_type_invoice_number_key`).catch(() => {});
    await db.query(`DROP INDEX IF EXISTS idx_invoices_company_number_active`).catch(() => {});
    await db.query(`DROP INDEX IF EXISTS idx_invoices_company_type_number`).catch(() => {});
    // ─────────────────────────────────────────────────────────────────────────

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
            ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
            ALTER TABLE users ADD COLUMN IF NOT EXISTS meta JSONB;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS bill_category VARCHAR(50);
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS tax_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS sub_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS cgst_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS sgst_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS igst_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20);
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS broker_id INTEGER;
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS broker_commission_rate NUMERIC(5,2);
            ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS purchase_number VARCHAR(100);
        `);

        // 9b. Ensure purchase_bill_items has all required columns
        //     (this table may have been created before GST columns were added to the schema)
        await db.pgRun(`
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
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
        // 10b. Ensure purchase_bill_expenses table exists (expense bills)
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS purchase_bill_expenses (
                id SERIAL PRIMARY KEY,
                bill_id INTEGER REFERENCES purchase_bills(id) ON DELETE CASCADE,
                expense_type VARCHAR(100) NOT NULL,
                description TEXT,
                amount NUMERIC(15,2) NOT NULL DEFAULT 0,
                tax_percent NUMERIC(5,2) DEFAULT 0,
                cgst_amount NUMERIC(15,2) DEFAULT 0,
                sgst_amount NUMERIC(15,2) DEFAULT 0,
                igst_amount NUMERIC(15,2) DEFAULT 0,
                total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

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
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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

        // Proprietor transactions
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS proprietor_transactions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                branch_id INTEGER DEFAULT 1,
                transaction_type VARCHAR(20) NOT NULL,
                amount NUMERIC(15,2) NOT NULL,
                payment_mode VARCHAR(20) DEFAULT 'CASH',
                transaction_date DATE NOT NULL,
                notes TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Cash transfers (branch ↔ main branch handovers)
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS cash_transfers (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                from_branch_id INTEGER,
                to_branch_id INTEGER,
                transfer_type VARCHAR(30) DEFAULT 'BRANCH_TO_MAIN',
                amount NUMERIC(15,2) NOT NULL,
                payment_mode VARCHAR(20) DEFAULT 'CASH',
                transfer_date DATE NOT NULL,
                reference_no VARCHAR(100),
                notes TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Customer ledger — tracks payments received from customers
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_ledger (
                id            SERIAL PRIMARY KEY,
                customer_id   INTEGER NOT NULL,
                company_id    INTEGER NOT NULL,
                branch_id     INTEGER,
                date          DATE NOT NULL,
                type          VARCHAR(50) NOT NULL,
                description   TEXT,
                debit         NUMERIC(14,2) DEFAULT 0,
                credit        NUMERIC(14,2) DEFAULT 0,
                created_at    TIMESTAMP DEFAULT NOW()
            )
        `);

        // Bill format settings: add bank details + state fields
        await db.query(`ALTER TABLE bill_format_settings ADD COLUMN IF NOT EXISTS state VARCHAR(100)`);
        await db.query(`ALTER TABLE bill_format_settings ADD COLUMN IF NOT EXISTS state_code VARCHAR(10)`);
        await db.query(`ALTER TABLE bill_format_settings ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)`);
        await db.query(`ALTER TABLE bill_format_settings ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50)`);
        await db.query(`ALTER TABLE bill_format_settings ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20)`);
        await db.query(`ALTER TABLE bill_format_settings ADD COLUMN IF NOT EXISTS bill_type VARCHAR(20) DEFAULT 'INVOICE'`);

        // Invoice sequences — one atomic counter per (company, type, month)
        await db.query(`
            CREATE TABLE IF NOT EXISTS invoice_sequences (
                id              SERIAL PRIMARY KEY,
                company_id      INTEGER NOT NULL,
                invoice_type    VARCHAR(50) NOT NULL,
                financial_month VARCHAR(20) NOT NULL,
                last_sequence   INTEGER NOT NULL DEFAULT 0,
                UNIQUE (company_id, invoice_type, financial_month)
            )
        `);

        // Invoice number series — TAX / INV / NSB separate counters per month
        await db.query(`
            CREATE TABLE IF NOT EXISTS invoice_number_series (
                id          SERIAL PRIMARY KEY,
                bill_type   VARCHAR(20) NOT NULL,
                prefix      VARCHAR(10) NOT NULL,
                year        INTEGER NOT NULL,
                month       INTEGER NOT NULL,
                last_number INTEGER DEFAULT 0,
                UNIQUE (bill_type, year, month)
            )
        `);
        await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_prefix VARCHAR(10)`);
        await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_number INTEGER`);

        // Loan improvements — private lender support
        await db.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_type VARCHAR(20) DEFAULT 'BANK'`);
        await db.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS principal_outstanding NUMERIC(15,2)`);
        await db.query(`ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'emi'`);
        // Make duration_months nullable so PRIVATE loans can omit it
        await db.query(`ALTER TABLE loans ALTER COLUMN duration_months DROP NOT NULL`).catch(() => {});

        // Loan receipts — tracks how loan was received (cash/bank/upi breakdown)
        await db.query(`
            CREATE TABLE IF NOT EXISTS loan_receipts (
                id         SERIAL PRIMARY KEY,
                loan_id    INTEGER REFERENCES loans(id) ON DELETE CASCADE,
                method     VARCHAR(20) NOT NULL,
                amount     NUMERIC(12,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Purchase bill internal tracking number
        await db.query(`ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS purchase_number VARCHAR(30)`);

        // Loans — soft delete + lender outstanding sync columns
        await db.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`);
        await db.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE lenders ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15,2) DEFAULT 0`);

        // FIX 2: Auto-create loan records for lenders with opening_balance but no loan
        // Safe: wrapped in DO $$ block so it only inserts missing ones
        await db.query(`
            DO $$
            DECLARE r RECORD;
            BEGIN
                FOR r IN
                    SELECT id, lender_name, lender_type, opening_balance, company_id
                    FROM lenders
                    WHERE COALESCE(opening_balance, 0) > 0
                      AND id NOT IN (
                          SELECT lender_id FROM loans WHERE lender_id IS NOT NULL
                      )
                LOOP
                    INSERT INTO loans (
                        company_id, lender_id, party_name, party_type, loan_type,
                        loan_direction, principal_amount, principal_outstanding,
                        interest_rate, interest_type, start_date, duration_months,
                        repayment_cycle, status, notes
                    ) VALUES (
                        r.company_id, r.id, r.lender_name,
                        CASE WHEN r.lender_type IN ('Bank','BANK') THEN 'BANK' ELSE 'PRIVATE' END,
                        CASE WHEN r.lender_type IN ('Bank','BANK') THEN 'BANK' ELSE 'PRIVATE' END,
                        'BORROWED', r.opening_balance, r.opening_balance,
                        12,
                        CASE WHEN r.lender_type IN ('Bank','BANK') THEN 'REDUCING' ELSE 'FLAT' END,
                        CURRENT_DATE, 0,
                        CASE WHEN r.lender_type IN ('Bank','BANK') THEN 'MONTHLY' ELSE 'INDEFINITE' END,
                        'ACTIVE', 'Auto-created from lender opening balance'
                    );
                END LOOP;
            END $$;
        `);

        // FIX 6: Sync lender current_balance = sum of active loan principals
        // Only use stable columns (status) — is_deleted added above but may not exist yet on older DBs
        await db.query(`
            UPDATE lenders le
            SET current_balance = (
                SELECT COALESCE(SUM(COALESCE(l.principal_outstanding, l.principal_amount)), 0)
                FROM loans l
                WHERE l.lender_id = le.id
                  AND l.status = 'ACTIVE'
            )
        `);

        // DATA FIX: ensure every product with opening_stock > 0 has a branch_inventory row
        // for its owning branch (backfill for products created before branch_inventory was enforced)
        await db.query(`
            INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock)
            SELECT p.company_id, p.branch_id, p.id, p.current_stock
            FROM products p
            WHERE p.is_deleted = false
              AND p.branch_id IS NOT NULL
              AND p.current_stock > 0
            ON CONFLICT (branch_id, product_id) DO NOTHING
        `).catch(() => {});

        // Personal Accounts (proprietor's GPay, PhonePe, bank, cash)
        await db.query(`
            CREATE TABLE IF NOT EXISTS personal_accounts (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                account_name VARCHAR(100) NOT NULL,
                account_type VARCHAR(20) NOT NULL DEFAULT 'upi',
                upi_id VARCHAR(100),
                bank_name VARCHAR(100),
                account_number VARCHAR(100),
                ifsc_code VARCHAR(50),
                holder_name VARCHAR(100),
                notes TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `).catch(() => {});

        // Extend proprietor_transactions for 4-type system
        await db.query(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS personal_account_id INTEGER REFERENCES personal_accounts(id)`).catch(() => {});
        await db.query(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS party_name VARCHAR(200)`).catch(() => {});
        await db.query(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS reference_id INTEGER`).catch(() => {});
        await db.query(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
        await db.query(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS affects_ledger BOOLEAN DEFAULT true`).catch(() => {});

        // Extend invoice_payments for personal-account payment mode
        await db.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS is_personal_account BOOLEAN DEFAULT false`).catch(() => {});
        await db.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS personal_account_id INTEGER REFERENCES personal_accounts(id)`).catch(() => {});

        // ═══════════════════════════════════════════════════════════
        // ENTERPRISE INVENTORY ENGINE — Schema + Data Integrity Fixes
        // ═══════════════════════════════════════════════════════════

        // 1. Add audit columns to inventory_movements (for full audit trail)
        await db.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS previous_qty NUMERIC(12,2)`).catch(() => {});
        await db.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS new_qty NUMERIC(12,2)`).catch(() => {});
        await db.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS movement_type VARCHAR(50)`).catch(() => {});

        // 2. Normalize movement type — old rows used type='SALE' or type='Opening Stock';
        //    new engine uses type='SALE_OUT' / 'PURCHASE_IN' etc. Keep old rows as-is.

        // 3. DATA INTEGRITY: Remove ghost branch_inventory rows.
        //    A ghost row is one where a branch has stock > 0 but NO inventory movement
        //    has ever added stock to that branch (no PURCHASE_IN, no Opening Stock, no TRANSFER_IN).
        //    These are caused by the old `branch_id || 1` product-creation bug or stale migrations.
        await db.query(`
            UPDATE branch_inventory bi
            SET current_stock = 0, last_updated = NOW()
            WHERE bi.current_stock > 0
              AND NOT EXISTS (
                SELECT 1 FROM inventory_movements im
                WHERE im.branch_id   = bi.branch_id
                  AND im.product_id  = bi.product_id
                  AND im.qty_in      > 0
              )
        `).catch((e) => { console.warn('[schemaUpdates] ghost-row cleanup skipped:', e.message); });

        // 4. Recompute products.current_stock = SUM(branch_inventory) for all products.
        //    Ensures the cache is consistent after any cleanup above.
        await db.query(`
            UPDATE products p
            SET current_stock = COALESCE((
                SELECT SUM(bi.current_stock)
                FROM branch_inventory bi
                WHERE bi.product_id = p.id
            ), 0)
            WHERE p.is_deleted = false
        `).catch((e) => { console.warn('[schemaUpdates] current_stock recompute skipped:', e.message); });

        // 5. Ensure last_updated column exists on branch_inventory (older DBs may lack it)
        await db.query(`ALTER TABLE branch_inventory ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()`).catch(() => {});

        // ── Invoice number series — clean rebuild ────────────────────────────
        // Format: PREFIX/YEAR/MM/NNN (e.g. TAX/2026/05/001)
        // Each (company, bill_type, year, month) = one row = independent counter.
        // Drop the old table entirely and recreate with the correct schema.
        await db.query(`DROP TABLE IF EXISTS invoice_number_series`).catch(() => {});
        await db.query(`
            CREATE TABLE IF NOT EXISTS invoice_number_series (
                id          SERIAL PRIMARY KEY,
                company_id  INTEGER NOT NULL,
                bill_type   VARCHAR(20) NOT NULL,
                prefix      VARCHAR(10) NOT NULL,
                year        INTEGER NOT NULL,
                month       INTEGER NOT NULL,
                last_number INTEGER DEFAULT 0,
                UNIQUE (company_id, bill_type, year, month)
            )
        `).catch((e) => { console.warn('[schemaUpdates] invoice_number_series create skipped:', e.message); });

        // ── Drop ALL old unique constraints on invoice_number (any name) ─────────
        // These block creating invoice #1 if any other invoice ever had number "1".
        // Use DROP CONSTRAINT IF EXISTS (each in its own query so one failure doesn't block others).
        await db.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key`).catch(() => {});
        await db.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_invoice_number_key`).catch(() => {});
        await db.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_type_invoice_number_key`).catch(() => {});
        await db.query(`DROP INDEX IF EXISTS idx_invoices_company_number_active`).catch(() => {});
        await db.query(`DROP INDEX IF EXISTS idx_invoices_company_type_number`).catch(() => {});
        // Unique index on series_number (not invoice_number).
        // series_number is only > 0 on invoices from the NEW auto-generate system.
        // Old invoices have series_number = 0/NULL → excluded → no conflicts with old data.
        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_company_type_series_num
              ON invoices (company_id, invoice_type, series_number)
              WHERE COALESCE(series_number, 0) > 0
                AND (is_deleted = false OR is_deleted IS NULL)
        `).catch((e) => { console.warn('[schemaUpdates] series_number unique index skipped:', e.message); });

        console.log("✅ Schema Updates Completed.");
    } catch (err) {
        console.error("❌ Schema Update Error:", err);
    }
};