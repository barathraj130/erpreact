import * as db from '../backend/database/pg.js';

async function diagnose() {
    try {
        console.log("--- 🕵️ DB DIAGNOSIS ---");
        
        const tables = await db.pgAll("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log("Tables:", tables.map(t => t.tablename).join(", "));

        const ledgerCount = await db.pgGet("SELECT COUNT(*) as count FROM ledger_entries");
        console.log("Ledger Entries Count:", ledgerCount.count);

        const columns = await db.pgAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ledger_entries'");
        console.log("Ledger Entries Columns:", columns.map(c => `${c.column_name} (${c.data_type})`).join(", "));

        const recent = await db.pgAll("SELECT * FROM ledger_entries ORDER BY id DESC LIMIT 5");
        console.log("Recent Entries:", JSON.stringify(recent, null, 2));

    } catch (err) {
        console.error("Diagnosis failed:", err);
    }
}

diagnose();
