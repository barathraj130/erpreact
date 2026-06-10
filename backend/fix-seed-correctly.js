// backend/fix-seed-correctly.js
import bcrypt from "bcryptjs";
import * as db from "./database/pg.js";

async function run() {
    console.log("🛠️ Re-seeding correctly...");
    try {
        const passwordHash = await bcrypt.hash("password123", 10);
        const farFuture = new Date();
        farFuture.setFullYear(farFuture.getFullYear() + 20);

        // --- 1. SUBSCRIPTIONS ---
        const titanModules = "sales,inventory,procurement,finance,hr,ai,documents,analytics";
        const resSub1 = await db.pgRun(
            `INSERT INTO subscriptions (plan_name, enabled_modules, ai_enabled, analytics_enabled, status, expiry_date)
             VALUES ($1, $2, $3, $4, 'ACTIVE', $5) RETURNING id`,
            ["Enterprise", titanModules, true, true, farFuture]
        );
        const sub1Id = resSub1.rows[0].id;

        const swiftModules = "sales,inventory,procurement,finance,documents";
        const resSub2 = await db.pgRun(
            `INSERT INTO subscriptions (plan_name, enabled_modules, ai_enabled, analytics_enabled, status, expiry_date)
             VALUES ($1, $2, $3, $4, 'ACTIVE', $5) RETURNING id`,
            ["Growth", swiftModules, false, false, farFuture]
        );
        const sub2Id = resSub2.rows[0].id;

        // --- 2. COMPANIES ---
        const resComp1 = await db.pgRun(
            `INSERT INTO companies (company_name, company_code, subscription_id, is_active, status)
             VALUES ($1, $2, $3, TRUE, 'ACTIVE')
             ON CONFLICT (company_name) DO UPDATE SET company_code = EXCLUDED.company_code, subscription_id = EXCLUDED.subscription_id
             RETURNING id`,
            ["Titan Industries", "TITAN-X", sub1Id]
        );
        const comp1Id = resComp1.rows[0].id;

        const resComp2 = await db.pgRun(
            `INSERT INTO companies (company_name, company_code, subscription_id, is_active, status)
             VALUES ($1, $2, $3, TRUE, 'ACTIVE')
             ON CONFLICT (company_name) DO UPDATE SET company_code = EXCLUDED.company_code, subscription_id = EXCLUDED.subscription_id
             RETURNING id`,
            ["Swift Logistics", "SWIFT-LOG", sub2Id]
        );
        const comp2Id = resComp2.rows[0].id;

        // --- 3. USERS ---
        // Clean up old ones first to avoid conflict if I messed up usernames
        await db.pgRun("DELETE FROM users WHERE username IN ('titan_admin', 'swift_admin')");

        await db.pgRun(
            `INSERT INTO users (company_id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [comp1Id, "titan_admin", "admin@titan.com", passwordHash, "admin", true]
        );

        await db.pgRun(
            `INSERT INTO users (company_id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [comp2Id, "swift_admin", "admin@swift.com", passwordHash, "admin", true]
        );

        console.log("✅ Seeded correctly! Company IDs:", comp1Id, comp2Id);
        process.exit(0);
    } catch (err) {
        console.error("❌ Fix failed:", err);
        process.exit(1);
    }
}

run();
