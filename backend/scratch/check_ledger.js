
import db from '../database/pg.js';

async function checkLedger() {
    try {
        console.log("--- LATEST TRANSACTIONS ---");
        const txs = await db.pgAll("SELECT * FROM transactions ORDER BY id DESC LIMIT 5");
        console.table(txs);

        console.log("\n--- LATEST LEDGER ENTRIES FOR PURCHASE_BILL ---");
        const entries = await db.pgAll(`
            SELECT l.*, ca.name as account_name, ca.account_code 
            FROM ledger_entries l 
            JOIN chart_of_accounts ca ON l.account_id = ca.id 
            WHERE l.transaction_id IN (SELECT id FROM transactions WHERE reference_type = 'PURCHASE_BILL') 
            ORDER BY l.id DESC LIMIT 20
        `);
        console.table(entries);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkLedger();
