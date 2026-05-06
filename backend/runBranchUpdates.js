
import * as db from "./database/pg.js";
import branchSystemUpdates from "./database/branchSystemSchema.js";

async function runBranchUpdates() {
    console.log("🚀 Starting Branch System Schema Updates...");
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        for (const sql of branchSystemUpdates) {
            console.log(`Executing: ${sql.substring(0, 50)}...`);
            await client.query(sql);
        }
        await client.query("COMMIT");
        console.log("✅ Branch System Schema Updated Successfully!");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Schema Update Failed:", err);
    } finally {
        client.release();
        process.exit(0);
    }
}

runBranchUpdates();
