import * as db from '../backend/database/pg.js';

async function checkTransactions() {
    try {
        const columns = await db.pgAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'");
        console.log("Transactions Columns:", columns.map(c => `${c.column_name} (${c.data_type})`).join(", "));
    } catch (err) {
        console.error("Transactions check failed:", err);
    }
}

checkTransactions();
