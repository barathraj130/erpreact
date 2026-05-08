import * as db from '../backend/database/pg.js';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function test() {
    try {
        const res = await db.pgGet("SELECT bill_purpose FROM ledger_entries LIMIT 1");
        console.log("SUCCESS:", res);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
}
test();
