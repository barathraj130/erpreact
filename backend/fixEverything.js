// backend/fixEverything.js
import db from "./database/pg.js";

async function fixEverything() {
    console.log("🛠️  STARTING FULL DATA REPAIR...");

    try {
        // --- 1. ENSURE COMPANY EXISTS ---
        console.log("1️⃣  Checking Company...");
        await db.pgRun(`
            INSERT INTO companies (id, company_name, gstin) 
            VALUES (1, 'My Company', 'TEMP12345') 
            ON CONFLICT (id) DO NOTHING
        `);

        // --- 2. LINK ORPHAN DATA (Products, Invoices, Bills) ---
        console.log("2️⃣  Linking Orphan Data to Company 1...");
        await db.pgRun("UPDATE products SET company_id = 1 WHERE company_id IS NULL");
        await db.pgRun("UPDATE invoices SET company_id = 1 WHERE company_id IS NULL");
        await db.pgRun("UPDATE purchase_bills SET company_id = 1 WHERE company_id IS NULL");
        await db.pgRun("UPDATE ledgers SET company_id = 1 WHERE company_id IS NULL");

        // --- 3. FIX CUSTOMER DATA ---
        console.log("3️⃣  Fixing Users & Customers...");
        
        // Link all users to Company 1 if missing
        await db.pgRun("UPDATE users SET active_company_id = 1 WHERE active_company_id IS NULL");

        // Fix Role Names (Convert 'Customer', 'client', NULL -> 'user')
        // PROTECTS: 'admin', 'manager', 'staff' so they don't get downgraded
        const result = await db.pgRun(`
            UPDATE users 
            SET role = 'user' 
            WHERE (role NOT IN ('admin', 'manager', 'staff') OR role IS NULL)
        `);
        
        console.log(`   👉 Fixed ${result.rowCount} customer roles.`);

        console.log("\n✅ REPAIR COMPLETE! All data is now visible and linked.");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ Repair Failed:", err);
        process.exit(1);
    }
}

fixEverything();