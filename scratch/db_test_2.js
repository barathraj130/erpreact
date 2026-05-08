import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const pool = new pg.Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT
});

async function run() {
    try {
        console.log("Connecting to:", process.env.PG_DATABASE);
        const res = await pool.query("SELECT bill_purpose FROM ledger_entries LIMIT 1");
        console.log("SUCCESS:", res.rows[0]);
    } catch(e) {
        console.error("FAILED:", e.message);
    } finally {
        await pool.end();
    }
}
run();
