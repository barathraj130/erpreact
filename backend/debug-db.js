// backend/debug-db.js
import * as db from "./database/pg.js";

async function debug() {
    console.log("🔍 Debugging database state...");
    try {
        const companies = await db.pgAll("SELECT * FROM companies");
        console.log("COMPANIES:", JSON.stringify(companies, null, 2));

        const subscriptions = await db.pgAll("SELECT * FROM subscriptions");
        console.log("SUBSCRIPTIONS:", JSON.stringify(subscriptions, null, 2));

        const users = await db.pgAll("SELECT id, username, email, company_id FROM users");
        console.log("USERS:", JSON.stringify(users, null, 2));

        process.exit(0);
    } catch (error) {
        console.error("Debug failed:", error);
        process.exit(1);
    }
}

debug();
