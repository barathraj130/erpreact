// backend/scripts/run-migrations.js
const path = require('path');

// FIX: Use 'database' directory instead of 'db' and absolute path
const dbPath = path.join(process.cwd(), 'backend', 'database', 'pg');

// We wrap the require in a try/catch block to provide better startup diagnostics
let pgModule;
try {
    pgModule = require(dbPath);
} catch (e) {
    console.error(`❌ FATAL: Could not load PG module from ${dbPath}!`);
    console.error(`❌ Error details: ${e.message}`);
    process.exit(1);
}

// CRITICAL FIX: Safely destructure and check if the pool object exists and is valid.
const { pool } = pgModule || {}; 

if (!pool || typeof pool.connect !== 'function') {
    console.error("❌ CRITICAL CONFIGURATION ERROR: PostgreSQL pool initialization failed.");
    console.error("   Ensure your .env file is present and the PG_ environment variables (USER, HOST, PASSWORD, DATABASE) are correctly set.");
    process.exit(1);
}

async function runMigrations() {
    console.log("ℹ️ Starting database schema verification/migrations...");
    
    let client;
    try {
        // Attempt to get a client from the initialized pool
        client = await pool.connect(); 
    } catch (e) {
        console.error("❌ CRITICAL DB ERROR: Failed to acquire PostgreSQL client connection.");
        console.error("   Check your PostgreSQL server status, firewall rules, and .env configuration.");
        throw e; // Re-throw the connection error
    }

    try {
        await client.query('BEGIN');
        
        const createTableStatements = [
            `CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY, 
                company_name VARCHAR(255) NOT NULL UNIQUE, 
                address_line1 TEXT, address_line2 TEXT, city_pincode TEXT, state TEXT, 
                gstin VARCHAR(20) UNIQUE, state_code VARCHAR(5), phone VARCHAR(20), 
                email VARCHAR(255) UNIQUE, bank_name TEXT, bank_account_no TEXT, bank_ifsc_code TEXT, 
                logo_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS ledger_groups (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                name VARCHAR(255) NOT NULL, 
                parent_id INTEGER REFERENCES ledger_groups(id) ON DELETE SET NULL, 
                nature VARCHAR(50) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                is_default BOOLEAN DEFAULT FALSE,
                UNIQUE (company_id, name)
            );`,
            `CREATE TABLE IF NOT EXISTS ledgers (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                name VARCHAR(255) NOT NULL, 
                group_id INTEGER REFERENCES ledger_groups(id) ON DELETE RESTRICT, 
                opening_balance NUMERIC DEFAULT 0, 
                is_dr INTEGER DEFAULT 1, 
                gstin VARCHAR(20), state VARCHAR(100), 
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (company_id, name)
            );`,
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                username VARCHAR(255) NOT NULL UNIQUE, 
                email VARCHAR(255) UNIQUE, 
                password_hash TEXT, 
                role VARCHAR(50) NOT NULL DEFAULT 'user', 
                phone VARCHAR(20), company TEXT, 
                initial_balance NUMERIC NOT NULL DEFAULT 0, 
                address_line1 TEXT, address_line2 TEXT, city_pincode TEXT, state TEXT, 
                gstin VARCHAR(20), state_code VARCHAR(5), 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                active_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL
            );`,
            `CREATE TABLE IF NOT EXISTS user_companies (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, company_id)
            );`,
            `CREATE TABLE IF NOT EXISTS bank_details (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                bank_name VARCHAR(255) NOT NULL, 
                account_number VARCHAR(50) UNIQUE NOT NULL, 
                ifsc_code VARCHAR(20), 
                account_type VARCHAR(50) DEFAULT 'Current', 
                branch_name TEXT, 
                ledger_id INTEGER REFERENCES ledgers(id) ON DELETE SET NULL, 
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS lenders (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                lender_name VARCHAR(255) NOT NULL, 
                entity_type VARCHAR(50) DEFAULT 'General',
                contact_person TEXT, phone VARCHAR(20), email VARCHAR(255), notes TEXT,
                initial_payable_balance NUMERIC DEFAULT 0, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (company_id, lender_name)
            );`,
            `CREATE TABLE IF NOT EXISTS stock_units (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                name VARCHAR(50) NOT NULL, 
                UNIQUE (company_id, name)
            );`,
            `CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                product_name VARCHAR(255) NOT NULL, 
                sku VARCHAR(50) UNIQUE, 
                description TEXT, cost_price NUMERIC DEFAULT 0, 
                sale_price NUMERIC NOT NULL DEFAULT 0, 
                current_stock INTEGER NOT NULL DEFAULT 0, 
                unit_id INTEGER REFERENCES stock_units(id) ON DELETE SET NULL, 
                hsn_acs_code VARCHAR(50), 
                low_stock_threshold INTEGER DEFAULT 0, 
                reorder_level INTEGER DEFAULT 0, 
                is_active INTEGER DEFAULT 1, 
                image_url TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (company_id, product_name)
            );`,
            `CREATE TABLE IF NOT EXISTS product_suppliers (
                id SERIAL PRIMARY KEY, 
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, 
                supplier_id INTEGER REFERENCES lenders(id) ON DELETE CASCADE,
                supplier_sku VARCHAR(50), 
                purchase_price NUMERIC, 
                lead_time_days INTEGER, 
                is_preferred INTEGER DEFAULT 0, 
                notes TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                UNIQUE (product_id, supplier_id)
            );`,
            `CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, 
                lender_id INTEGER REFERENCES lenders(id) ON DELETE SET NULL, 
                agreement_id INTEGER, 
                amount NUMERIC NOT NULL, 
                description TEXT, 
                category TEXT NOT NULL, 
                date DATE NOT NULL, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                related_invoice_id INTEGER 
             );`,
             `CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY, 
                customer_id INTEGER REFERENCES users(id) ON DELETE RESTRICT, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
                invoice_number VARCHAR(100) UNIQUE NOT NULL, 
                invoice_date DATE NOT NULL, 
                due_date DATE NOT NULL, 
                total_amount NUMERIC NOT NULL DEFAULT 0, 
                paid_amount NUMERIC NOT NULL DEFAULT 0, 
                status VARCHAR(50) NOT NULL DEFAULT 'Draft', 
                invoice_type VARCHAR(50) NOT NULL DEFAULT 'TAX_INVOICE', 
                notes TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                selected_bank_details_id INTEGER REFERENCES bank_details(id) ON DELETE SET NULL,
                amount_before_tax NUMERIC DEFAULT 0, 
                total_cgst_amount NUMERIC DEFAULT 0, 
                total_sgst_amount NUMERIC DEFAULT 0, 
                total_igst_amount NUMERIC DEFAULT 0, 
                party_bill_returns_amount NUMERIC DEFAULT 0,
                reverse_charge VARCHAR(10), transportation_mode VARCHAR(100), vehicle_number VARCHAR(50), 
                date_of_supply DATE, place_of_supply_state VARCHAR(100), place_of_supply_state_code VARCHAR(5), 
                bundles_count INTEGER, consignee_name TEXT, consignee_address_line1 TEXT, 
                consignee_address_line2 TEXT, consignee_city_pincode TEXT, consignee_state TEXT, 
                consignee_gstin TEXT, consignee_state_code TEXT, amount_in_words TEXT, original_invoice_number TEXT
             );`,
             `CREATE TABLE IF NOT EXISTS invoice_line_items (
                id SERIAL PRIMARY KEY, 
                invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE, 
                product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, 
                description TEXT NOT NULL, 
                hsn_acs_code VARCHAR(50), 
                unit_of_measure VARCHAR(50),
                quantity NUMERIC NOT NULL, 
                unit_price NUMERIC NOT NULL, 
                discount_amount NUMERIC DEFAULT 0,
                taxable_value NUMERIC NOT NULL,
                cgst_rate NUMERIC DEFAULT 0, cgst_amount NUMERIC DEFAULT 0,
                sgst_rate NUMERIC DEFAULT 0, sgst_amount NUMERIC DEFAULT 0,
                igst_rate NUMERIC DEFAULT 0, igst_amount NUMERIC DEFAULT 0,
                line_total NUMERIC NOT NULL 
             );`,
            `CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                link TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY, 
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                user_id_acting INTEGER REFERENCES users(id) ON DELETE SET NULL, 
                action VARCHAR(100) NOT NULL, 
                entity_type VARCHAR(100) NOT NULL, 
                entity_id INTEGER, 
                details_before TEXT, 
                details_after TEXT, 
                ip_address VARCHAR(50)
            );`,
            `CREATE TABLE IF NOT EXISTS business_agreements (
                id SERIAL PRIMARY KEY, 
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                lender_id INTEGER REFERENCES lenders(id) ON DELETE CASCADE,
                agreement_type VARCHAR(50) NOT NULL,
                total_amount NUMERIC NOT NULL,
                interest_rate NUMERIC DEFAULT 0,
                emi_amount NUMERIC DEFAULT 0,
                duration_months INTEGER DEFAULT 0,
                start_date DATE NOT NULL,
                details TEXT,
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            // Add remaining FK constraints if not defined inline (must be run only if table exists)
            `DO $$ BEGIN 
               IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_agreement' AND conrelid = 'transactions'::regclass) THEN
                  ALTER TABLE transactions ADD CONSTRAINT fk_agreement FOREIGN KEY (agreement_id) REFERENCES business_agreements(id) ON DELETE SET NULL;
               END IF;
            END $$;`,
        ];
        
        // Execute all CREATE TABLE statements sequentially
        for (const stmt of createTableStatements) {
            await client.query(stmt).catch(err => {
                // Ignore specific errors related to table/constraint existence
                if (!err.message.includes('already exists') && !err.message.includes('cannot add the constraint')) {
                    console.error(`Error executing statement: ${stmt.substring(0, 50)}...`);
                    throw err; 
                }
            });
        }
        
        console.log("✅ Phase 1: All essential tables checked/created.");
        
        // --- Phase 2: Insert Default Ledgers/Groups (Crucial for successful signup) ---
        
        const defaultGroups = [
            { name: 'Primary', nature: 'Root', parent_id_name: null, is_default: true },
            { name: 'Capital Account', nature: 'Liability', parent_id_name: 'Primary', is_default: true },
            { name: 'Current Assets', nature: 'Asset', parent_id_name: 'Primary', is_default: true },
            { name: 'Current Liabilities', nature: 'Liability', parent_id_name: 'Primary', is_default: true },
            { name: 'Cash-in-Hand', nature: 'Asset', parent_id_name: 'Current Assets', is_default: true },
            { name: 'Bank Accounts', nature: 'Asset', parent_id_name: 'Current Assets', is_default: true },
            { name: 'Sundry Debtors', nature: 'Asset', parent_id_name: 'Current Assets', is_default: true },
            { name: 'Sundry Creditors', nature: 'Liability', parent_id_name: 'Current Liabilities', is_default: true },
            { name: 'Sales Accounts', nature: 'Income', parent_id_name: 'Primary', is_default: true },
            { name: 'Purchase Accounts', nature: 'Expense', parent_id_name: 'Primary', is_default: true },
            { name: 'Direct Expenses', nature: 'Expense', parent_id_name: 'Primary', is_default: true },
            { name: 'Indirect Expenses', nature: 'Expense', parent_id_name: 'Primary', is_default: true },
            { name: 'Direct Incomes', nature: 'Income', parent_id_name: 'Primary', is_default: true },
            { name: 'Indirect Incomes', nature: 'Income', parent_id_name: 'Primary', is_default: true },
        ];

        // 1. Ensure Default System Company Exists (ID=1)
        const defaultCompany = await client.query(`SELECT id FROM companies WHERE id = 1`).then(res => res.rows[0]);
        if (!defaultCompany) {
             // Use explicit column names to allow specifying ID
             await client.query(`INSERT INTO companies (id, company_name) VALUES (1, 'Default System Company')`);
             console.log("-> Inserted Default Company (ID=1).");
             
             // CRITICAL FIX: Reset the sequence after manual ID insert
             await client.query(`SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies))`);
             console.log("-> Reset companies_id_seq counter.");
        }

        // 2. Insert Base Groups for Default Company (ID=1)
        const insertedGroups = {};
        for (const group of defaultGroups) {
            const existing = await client.query('SELECT id FROM ledger_groups WHERE company_id = 1 AND name = $1', [group.name]).then(res => res.rows[0]);
            if (existing) {
                insertedGroups[group.name] = existing.id;
                continue;
            }

            let parentId = null;
            if (group.parent_id_name) {
                const parentRow = await client.query('SELECT id FROM ledger_groups WHERE company_id = 1 AND name = $1', [group.parent_id_name]).then(res => res.rows[0]);
                parentId = parentRow ? parentRow.id : null;
            }

            const insertQuery = `INSERT INTO ledger_groups (company_id, name, parent_id, nature, is_default) VALUES (1, $1, $2, $3, $4) RETURNING id`;
            const result = await client.query(insertQuery, [group.name, parentId, group.nature, group.is_default]);
            insertedGroups[group.name] = result.rows[0].id;
        }

        // 3. Insert Default Cash Ledger (Crucial for starting transactions)
        const cashLedger = await client.query(`SELECT id FROM ledgers WHERE company_id = 1 AND name = 'Cash'`).then(res => res.rows[0]);
        if (!cashLedger && insertedGroups['Cash-in-Hand']) {
            await client.query(`INSERT INTO ledgers (company_id, name, group_id, is_dr, is_default) VALUES (1, 'Cash', $1, 1, TRUE)`, [insertedGroups['Cash-in-Hand']]);
            console.log("-> Inserted Default Cash Ledger.");
        }
        
        console.log("✅ Phase 2: Essential ledgers and groups seeded for company ID 1.");

        await client.query('COMMIT');

    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(e => console.error("PG Rollback failed:", e.message));
        console.error("❌ FATAL: Database migration failed during transaction execution.");
        console.error("   Details:", error.message);
        throw error;
    } finally {
        if (client) client.release();
    }
}

// Execute the migration.
runMigrations()
    .then(() => {
        console.log("✅ Migrations completed successfully.");
    })
    .catch((err) => {
        // Log the error before exiting
        console.error(`❌ Migration process terminated. Error details: ${err.message}`);
        process.exit(1);
    });