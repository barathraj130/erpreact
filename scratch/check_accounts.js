
import * as db from './backend/database/pg.js';

async function checkAccounts() {
    try {
        console.log("Checking chart_of_accounts...");
        const rows = await db.pgAll("SELECT name, account_type, company_id FROM chart_of_accounts LIMIT 20");
        console.log(JSON.stringify(rows, null, 2));
        
        console.log("\nChecking ledger_entries count...");
        const count = await db.pgGet("SELECT COUNT(*) as count FROM ledger_entries");
        console.log(count);
    } catch (err) {
        console.error(err);
    }
}

checkAccounts();
