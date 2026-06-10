console.log("DEBUG: Script started");
import * as db from "../database/pg.js";

async function sync() {
    console.log("🚀 Starting Balance Sync...");
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // 1. Get all users who have transactions
        const users = await client.query("SELECT id, username FROM users");
        
        for (const user of users.rows) {
            console.log(`📊 Syncing user: ${user.username} (ID: ${user.id})`);
            
            // 2. Fetch all transactions for this user
            const txs = await client.query(
                "SELECT type, amount FROM transactions WHERE user_id = $1", 
                [user.id]
            );
            
            let newBalance = 0;
            for (const tx of txs.rows) {
                const amt = Number(tx.amount);
                if (tx.type === 'INVOICE') {
                    newBalance += amt;
                } else if (tx.type === 'RECEIPT' || tx.type === 'PAYMENT' || tx.type === 'DR') {
                    newBalance -= amt;
                }
                // Note: ADJUSTMENT types might need to be handled, 
                // but let's look at what we've recorded so far.
            }
            
            console.log(`   - New Calculated Balance: ${newBalance}`);
            
            // 3. Update user table
            await client.query(
                "UPDATE users SET initial_balance = $1 WHERE id = $2",
                [newBalance, user.id]
            );
        }

        await client.query("COMMIT");
        console.log("✅ Sync Complete!");
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Sync Failed:", err.message);
    } finally {
        if (client) client.release();
        process.exit();
    }
}

sync();
