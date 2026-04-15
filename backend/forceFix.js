// backend/forceFix.js
import db from "./database/pg.js";

async function fix() {
    console.log("🚑 Fixing All Users...");
    try {
        // 1. Ensure Default Company Exists
        await db.pgRun(`
            INSERT INTO companies (id, company_name, gstin) 
            VALUES (1, 'Default Company', 'TEMP12345') 
            ON CONFLICT (id) DO NOTHING
        `);

        // 2. Force ALL users to belong to Company 1 and have a valid role
        await db.pgRun(`
            UPDATE users 
            SET active_company_id = 1, 
                role = COALESCE(role, 'manager') 
            WHERE active_company_id IS NULL OR role IS NULL
        `);

        console.log("✅ All users fixed (Company ID set to 1).");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
fix();