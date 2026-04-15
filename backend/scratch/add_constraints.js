// backend/scratch/add_constraints.js
import db from "../database/pg.js";

async function run() {
    try {
        console.log("Applying Constraints...");
        await db.pgRun(`
            ALTER TABLE daily_ledger_closings 
            ADD CONSTRAINT unique_daily_closing 
            UNIQUE(company_id, branch_id, closing_date, ledger_type, bank_account_id)
        `);
        console.log("✅ Unique constraint added to daily_ledger_closings");

        await db.pgRun(`
            ALTER TABLE bank_ledger 
            ADD CONSTRAINT fk_bank_account 
            FOREIGN KEY (bank_account_id) REFERENCES bank_details(id)
        `);
        console.log("✅ Foreign key added to bank_ledger");

    } catch (err) {
        console.error("Error applying constraints:", err.message);
    } finally {
        process.exit(0);
    }
}

run();
