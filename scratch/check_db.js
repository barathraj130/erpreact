
import * as db from '../backend/database/pg.js';

async function listTables() {
    try {
        const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
        const tables = await db.pgAll(sql);
        console.log("TABLES:", tables.map(t => t.table_name));

        const invoiceCols = await db.pgAll("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices'");
        console.log("INVOICES COLUMNS:", invoiceCols.map(c => c.column_name));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

listTables();
