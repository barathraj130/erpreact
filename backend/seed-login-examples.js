// backend/seed-login-examples.js
import bcrypt from "bcryptjs";
import * as db from "./database/pg.js";

async function seed() {
    console.log("🌱 Updating example login accounts with correct module names...");

    try {
        const passwordHash = await bcrypt.hash("password123", 10);

        // --- 1. TITAN-X (Enterprise - All Modules) ---
        // We use the names checked in Sidebar.tsx: sales, inventory, procurement, finance, hr, ai, documents
        const titanModules = "sales,inventory,procurement,finance,hr,ai,documents,analytics";
        
        const sub1 = await db.pgRun(
            `INSERT INTO subscriptions (plan_name, enabled_modules, ai_enabled, analytics_enabled, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            ["Enterprise", titanModules, true, true, "ACTIVE"]
        );
        const sub1Id = sub1.id || sub1[0]?.id;

        const comp1 = await db.pgRun(
            `INSERT INTO companies (company_name, company_code, subscription_id, is_active, status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (company_name) DO UPDATE SET company_code = EXCLUDED.company_code, subscription_id = EXCLUDED.subscription_id
             RETURNING id`,
            ["Titan Industries", "TITAN-X", sub1Id, true, "ACTIVE"]
        );
        const comp1Id = comp1.id || comp1[0]?.id;

        await db.pgRun(
            `INSERT INTO users (company_id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, company_id = EXCLUDED.company_id, email = EXCLUDED.email`,
            [comp1Id, "titan_admin", "admin@titan.com", passwordHash, "admin", true]
        );

        // --- 2. SWIFT-LOG (Growth - No HR or AI) ---
        const swiftModules = "sales,inventory,procurement,finance,documents";
        
        const sub2 = await db.pgRun(
            `INSERT INTO subscriptions (plan_name, enabled_modules, ai_enabled, analytics_enabled, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            ["Growth", swiftModules, false, false, "ACTIVE"]
        );
        const sub2Id = sub2.id || sub2[0]?.id;

        const comp2 = await db.pgRun(
            `INSERT INTO companies (company_name, company_code, subscription_id, is_active, status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (company_name) DO UPDATE SET company_code = EXCLUDED.company_code, subscription_id = EXCLUDED.subscription_id
             RETURNING id`,
            ["Swift Logistics", "SWIFT-LOG", sub2Id, true, "ACTIVE"]
        );
        const comp2Id = comp2.id || comp2[0]?.id;

        await db.pgRun(
            `INSERT INTO users (company_id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, company_id = EXCLUDED.company_id, email = EXCLUDED.email`,
            [comp2Id, "swift_admin", "admin@swift.com", passwordHash, "admin", true]
        );

        console.log("✅ Seeding complete! Accounts ready for login.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seed();
