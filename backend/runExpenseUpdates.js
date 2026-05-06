
import * as db from "./database/pg.js";
import expenseBillUpdates from "./database/expenseBillSchema.js";

async function runExpenseUpdates() {
    console.log("🚀 Starting Expense Bill Schema Updates...");
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        for (const sql of expenseBillUpdates) {
            console.log(`Executing: ${sql.substring(0, 50)}...`);
            await client.query(sql);
        }
        await client.query("COMMIT");
        console.log("✅ Expense Bill Schema Updated Successfully!");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Schema Update Failed:", err);
    } finally {
        client.release();
        process.exit(0);
    }
}

runExpenseUpdates();
