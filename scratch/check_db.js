
import * as db from '../backend/database/pg.js';

async function checkConstraints() {
    try {
        const sql = `
            SELECT 
                conname as constraint_name,
                pg_get_constraintdef(c.oid) as definition
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'transaction_lines'::regclass;
        `;
        const constraints = await db.pgAll(sql);
        console.log("TRANSACTION_LINES CONSTRAINTS:");
        console.log(JSON.stringify(constraints, null, 2));

        const coaSql = "SELECT id FROM chart_of_accounts LIMIT 5";
        const coa = await db.pgAll(coaSql);
        console.log("COA IDs:", coa?.map(c => c.id));

        const ledgerSql = "SELECT id FROM ledgers LIMIT 5";
        const ledgers = await db.pgAll(ledgerSql);
        console.log("LEDGER IDs:", ledgers?.map(l => l.id));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkConstraints();
