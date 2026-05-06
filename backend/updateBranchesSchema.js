import * as db from './database/pg.js';

async function run() {
    try {
        console.log("Altering branches table...");
        
        await db.pgRun(`
            ALTER TABLE branches
            ADD COLUMN IF NOT EXISTS branch_type VARCHAR(50) DEFAULT 'Sub Branch',
            ADD COLUMN IF NOT EXISTS address_line2 TEXT,
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
            ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
            ADD COLUMN IF NOT EXISTS branch_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS branch_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS manager_whatsapp VARCHAR(50),
            ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
            ADD COLUMN IF NOT EXISTS default_payment_mode VARCHAR(50) DEFAULT 'Cash',
            ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC(15,2) DEFAULT 0
        `);

        console.log("Success.");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        process.exit();
    }
}

run();
