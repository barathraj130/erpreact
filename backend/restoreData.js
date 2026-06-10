// backend/restoreData.js
import db from "./database/pg.js";

async function restore() {
    console.log("♻️  RESTORING OLD DATA...");

    try {
        // 1. Ensure Company 1 Exists
        await db.pgRun(`
            INSERT INTO companies (id, company_name, gstin) 
            VALUES (1, 'My Company', 'TEMP12345') 
            ON CONFLICT (id) DO NOTHING
        `);

        // 2. Link Orphans to Company 1
        console.log("   👉 Linking Products...");
        await db.pgRun("UPDATE products SET company_id = 1 WHERE company_id IS NULL");

        console.log("   👉 Linking Invoices...");
        await db.pgRun("UPDATE invoices SET company_id = 1 WHERE company_id IS NULL");

        console.log("   👉 Linking Purchase Bills...");
        await db.pgRun("UPDATE purchase_bills SET company_id = 1 WHERE company_id IS NULL");

        console.log("   👉 Linking Customers...");
        // Ensure customers are linked to company 1
        await db.pgRun("UPDATE users SET active_company_id = 1 WHERE active_company_id IS NULL");
        
        // Ensure Users without a role become 'user' (Customer)
        // We protect 'admin', 'manager', and 'staff' from being changed
        await db.pgRun(`
            UPDATE users 
            SET role = 'user' 
            WHERE role IS NULL 
               OR role NOT IN ('admin', 'manager', 'staff', 'user')
        `);

        console.log("   👉 Linking Ledgers...");
        await db.pgRun("UPDATE ledgers SET company_id = 1 WHERE company_id IS NULL");

        console.log("\n✅ DATA RESTORED! Go to your dashboard and refresh.");
        process.exit(0);

    } catch (err) {
        console.error("❌ Error restoring data:", err);
        process.exit(1);
    }
}

restore();