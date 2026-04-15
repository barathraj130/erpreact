// backend/database/dynamicSchema.js
const pgModule = require('./pg');

// ==========================================
// 1. DEFINE YOUR IDEAL DATABASE SCHEMA HERE
// ==========================================
const targetSchema = {
    companies: {
        id: "SERIAL PRIMARY KEY",
        company_name: "VARCHAR(255) NOT NULL UNIQUE",
        address_line1: "TEXT",
        address_line2: "TEXT",
        city_pincode: "TEXT",
        state: "TEXT",
        gstin: "VARCHAR(20) UNIQUE",
        state_code: "VARCHAR(5)",
        phone: "VARCHAR(20)",
        email: "VARCHAR(255) UNIQUE",
        bank_name: "TEXT",
        bank_account_no: "TEXT",
        bank_ifsc_code: "TEXT",
        logo_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    users: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER", // simplified for dynamic checks
        username: "VARCHAR(255) NOT NULL UNIQUE",
        nickname: "VARCHAR(100)",
        email: "VARCHAR(255)",
        password_hash: "TEXT",
        role: "VARCHAR(50) NOT NULL DEFAULT 'user'",
        phone: "VARCHAR(50)",
        company: "TEXT", // <--- Added dynamically to fix your error
        initial_balance: "NUMERIC DEFAULT 0",
        address_line1: "TEXT",
        address_line2: "TEXT",
        city_pincode: "VARCHAR(50)",
        state: "VARCHAR(100)",
        state_code: "VARCHAR(10)",
        gstin: "VARCHAR(50)",
        active_company_id: "INTEGER",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    invoices: {
        id: "SERIAL PRIMARY KEY",
        customer_id: "INTEGER",
        company_id: "INTEGER",
        invoice_number: "VARCHAR(100)",
        invoice_date: "DATE",
        due_date: "DATE",
        total_amount: "NUMERIC DEFAULT 0",
        paid_amount: "NUMERIC DEFAULT 0",
        status: "VARCHAR(50) DEFAULT 'Draft'",
        invoice_type: "VARCHAR(50) DEFAULT 'TAX_INVOICE'",
        invoice_category: "VARCHAR(50) DEFAULT 'TAX'",
        financial_month: "VARCHAR(20)",
        payment_mode: "VARCHAR(20) DEFAULT 'CASH'",
        transaction_ref: "VARCHAR(100)",
        notes: "TEXT",
        is_digital_signed: "BOOLEAN DEFAULT FALSE",
        watermark_text: "TEXT",
        reverse_charge: "VARCHAR(10)",
        vehicle_number: "VARCHAR(50)",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    invoice_line_items: {
        id: "SERIAL PRIMARY KEY",
        invoice_id: "INTEGER",
        product_id: "INTEGER",
        description: "TEXT",
        hsn_acs_code: "VARCHAR(50)",
        quantity: "NUMERIC",
        unit_price: "NUMERIC",
        line_total: "NUMERIC"
    },
    products: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        product_name: "VARCHAR(255)",
        sku: "VARCHAR(50)",
        description: "TEXT",
        cost_price: "NUMERIC DEFAULT 0",
        sale_price: "NUMERIC DEFAULT 0",
        current_stock: "NUMERIC DEFAULT 0",
        low_stock_threshold: "INTEGER DEFAULT 5",
        hsn_acs_code: "VARCHAR(50)",
        unit_id: "INTEGER",
        is_active: "INTEGER DEFAULT 1",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    transactions: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        user_id: "INTEGER",
        lender_id: "INTEGER",
        amount: "NUMERIC NOT NULL",
        type: "VARCHAR(50)", // Debit/Credit/Receipt/Payment
        category: "TEXT",
        description: "TEXT",
        date: "DATE NOT NULL",
        related_invoice_id: "INTEGER",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    lenders: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        lender_name: "VARCHAR(255)",
        entity_type: "VARCHAR(50)",
        phone: "VARCHAR(50)",
        initial_payable_balance: "NUMERIC DEFAULT 0",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    notifications: {
        id: "SERIAL PRIMARY KEY",
        user_id: "INTEGER",
        message: "TEXT",
        is_read: "BOOLEAN DEFAULT FALSE",
        created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    },
    audit_log: {
        id: "SERIAL PRIMARY KEY",
        action: "VARCHAR(100)",
        details_after: "TEXT",
        timestamp: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }
};

// ==========================================
// 2. DYNAMIC MIGRATION LOGIC
// ==========================================
async function syncDatabase() {
    console.log("🔄 Starting Dynamic Schema Sync...");
    const client = await pgModule.pool.connect();

    try {
        await client.query('BEGIN');

        for (const [tableName, columns] of Object.entries(targetSchema)) {
            // 1. Check if table exists
            const tableCheck = await client.query(
                `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
                [tableName]
            );

            if (!tableCheck.rows[0].exists) {
                console.log(`✨ Creating table: ${tableName}`);
                // Construct CREATE TABLE query
                const colDefs = Object.entries(columns)
                    .map(([col, def]) => `${col} ${def}`)
                    .join(", ");
                await client.query(`CREATE TABLE ${tableName} (${colDefs})`);
            } else {
                // 2. Table exists, check for missing columns
                const existingColsRes = await client.query(
                    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
                    [tableName]
                );
                const existingCols = existingColsRes.rows.map(r => r.column_name);

                for (const [colName, colDef] of Object.entries(columns)) {
                    if (!existingCols.includes(colName)) {
                        console.log(`➕ Adding missing column: ${tableName}.${colName}`);
                        // Add column dynamically
                        // Note: We strip constraints like 'PRIMARY KEY' for ADD COLUMN as they are tricky to add dynamically without specific naming
                        // Simple types work best here.
                        let cleanDef = colDef;
                        if(colDef.includes("PRIMARY KEY")) cleanDef = colDef.replace("PRIMARY KEY", "");
                        if(colDef.includes("SERIAL")) cleanDef = "INTEGER"; 
                        
                        await client.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${cleanDef}`);
                    }
                }
            }
        }

        // 3. Ensure Default Data (e.g. Admin Company)
        const companyCheck = await client.query("SELECT count(*) FROM companies");
        if (parseInt(companyCheck.rows[0].count) === 0) {
            console.log("🌱 Seeding default company...");
            await client.query(`
                INSERT INTO companies (id, company_name, state, gstin) 
                VALUES (1, 'Default Company', 'TAMILNADU', '33AAAAA0000A1Z5')
            `);
            // Reset sequence to safe value
            await client.query(`SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies)+1)`);
        }

        await client.query('COMMIT');
        console.log("✅ Database Sync Complete. Schema is up to date.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Schema Sync Failed:", err);
        process.exit(1);
    } finally {
        client.release();
    }
}

module.exports = { syncDatabase };