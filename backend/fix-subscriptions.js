// backend/fix-subscriptions.js
import * as db from "./database/pg.js";

async function fix() {
    console.log("🛠️ Fixing subscriptions for example accounts...");
    try {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 10); // 10 years from now

        // Update all subscriptions to be ACTIVE and have a future expiry
        await db.pgRun(
            "UPDATE subscriptions SET status = 'ACTIVE', expiry_date = $1",
            [futureDate]
        );

        // Double check the TITAN-X company
        const titan = await db.pgGet("SELECT * FROM companies WHERE company_code = 'TITAN-X'");
        console.log("TITAN-X Company Status:", titan?.status, "Is Active:", titan?.is_active);

        if (titan && (!titan.is_active || titan.status !== 'ACTIVE')) {
            await db.pgRun("UPDATE companies SET is_active = TRUE, status = 'ACTIVE' WHERE id = $1", [titan.id]);
            console.log("✅ TITAN-X updated to ACTIVE");
        }

        // Same for SWIFT-LOG
        const swift = await db.pgGet("SELECT * FROM companies WHERE company_code = 'SWIFT-LOG'");
        if (swift && (!swift.is_active || swift.status !== 'ACTIVE')) {
            await db.pgRun("UPDATE companies SET is_active = TRUE, status = 'ACTIVE' WHERE id = $1", [swift.id]);
            console.log("✅ SWIFT-LOG updated to ACTIVE");
        }

        console.log("✅ All subscriptions and companies fixed!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Fix failed:", error);
        process.exit(1);
    }
}

fix();
