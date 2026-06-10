// backend/seed-demo-companies.js
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || process.env.PG_USER,
    password: process.env.DB_PASSWORD || process.env.PG_PASSWORD,
    host: process.env.DB_HOST || process.env.PG_HOST || 'localhost',
    database: process.env.DB_NAME || process.env.PG_DATABASE,
    port: parseInt(process.env.DB_PORT || process.env.PG_PORT || '5432')
});

async function seedCompanies() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const passwordHash = await bcrypt.hash('password123', 10);

        // ========== COMPANY 1: TITAN-X (Enterprise - All Modules) ==========
        console.log("🏢 Creating TITAN-X (Enterprise)...");

        // Delete existing if any (clean slate)
        // Clean users by email/username first (in case they exist from previous seeds)
        await client.query("DELETE FROM users WHERE email IN ('admin@titan.com', 'admin@swift.com')");
        await client.query("DELETE FROM users WHERE username IN ('titan_admin', 'swift_admin')");

        const existingTitan = await client.query("SELECT id FROM companies WHERE company_code = 'TITAN-X'");
        if (existingTitan.rows.length > 0) {
            const cid = existingTitan.rows[0].id;
            await client.query("DELETE FROM users WHERE company_id = $1", [cid]);
            await client.query("DELETE FROM branches WHERE company_id = $1", [cid]);
            await client.query("DELETE FROM companies WHERE id = $1", [cid]);
            console.log("   🗑️  Cleaned up old TITAN-X data");
        }

        const existingSwift = await client.query("SELECT id FROM companies WHERE company_code = 'SWIFT-LOG'");
        if (existingSwift.rows.length > 0) {
            const cid = existingSwift.rows[0].id;
            await client.query("DELETE FROM users WHERE company_id = $1", [cid]);
            await client.query("DELETE FROM branches WHERE company_id = $1", [cid]);
            await client.query("DELETE FROM companies WHERE id = $1", [cid]);
            console.log("   🗑️  Cleaned up old SWIFT-LOG data");
        }

        // Clean up old subscriptions
        await client.query("DELETE FROM subscriptions WHERE id NOT IN (SELECT subscription_id FROM companies WHERE subscription_id IS NOT NULL) AND plan_name IN ('TITAN Enterprise', 'SWIFT Growth')");

        // Create subscription for TITAN-X
        const titanSubRes = await client.query(
            `INSERT INTO subscriptions (plan_name, status, max_branches, max_users, enabled_modules, expiry_date)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [
                'TITAN Enterprise',
                'ACTIVE',
                10,
                50,
                'sales,inventory,finance,hr,ai,reports,purchases',
                '2028-12-31'
            ]
        );
        const titanSubId = titanSubRes.rows[0].id;

        // Create TITAN-X company
        const titanCompRes = await client.query(
            `INSERT INTO companies (company_name, company_code, subscription_id, is_active)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            ['Titan Enterprises', 'TITAN-X', titanSubId, true]
        );
        const titanCompId = titanCompRes.rows[0].id;

        // Create default branch for TITAN-X
        const titanBranchRes = await client.query(
            `INSERT INTO branches (company_id, branch_name, is_active)
             VALUES ($1, $2, $3) RETURNING id`,
            [titanCompId, 'Head Office', true]
        );
        const titanBranchId = titanBranchRes.rows[0].id;

        // Create admin user for TITAN-X
        await client.query(
            `INSERT INTO users (company_id, active_company_id, branch_id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [titanCompId, titanCompId, titanBranchId, 'titan_admin', 'admin@titan.com', passwordHash, 'admin', true]
        );

        console.log("   ✅ TITAN-X created with Enterprise subscription (all modules)");

        // ========== COMPANY 2: SWIFT-LOG (Growth - No HR or AI) ==========
        console.log("🏢 Creating SWIFT-LOG (Growth)...");

        // Create subscription for SWIFT-LOG
        const swiftSubRes = await client.query(
            `INSERT INTO subscriptions (plan_name, status, max_branches, max_users, enabled_modules, expiry_date)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [
                'SWIFT Growth',
                'ACTIVE',
                3,
                15,
                'sales,inventory,finance,reports,purchases',
                '2028-12-31'
            ]
        );
        const swiftSubId = swiftSubRes.rows[0].id;

        // Create SWIFT-LOG company
        const swiftCompRes = await client.query(
            `INSERT INTO companies (company_name, company_code, subscription_id, is_active)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            ['Swift Logistics', 'SWIFT-LOG', swiftSubId, true]
        );
        const swiftCompId = swiftCompRes.rows[0].id;

        // Create default branch for SWIFT-LOG
        const swiftBranchRes = await client.query(
            `INSERT INTO branches (company_id, branch_name, is_active)
             VALUES ($1, $2, $3) RETURNING id`,
            [swiftCompId, 'Main Warehouse', true]
        );
        const swiftBranchId = swiftBranchRes.rows[0].id;

        // Create admin user for SWIFT-LOG
        await client.query(
            `INSERT INTO users (company_id, active_company_id, branch_id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [swiftCompId, swiftCompId, swiftBranchId, 'swift_admin', 'admin@swift.com', passwordHash, 'admin', true]
        );

        console.log("   ✅ SWIFT-LOG created with Growth subscription (no HR or AI)");

        await client.query('COMMIT');

        console.log("\n🎉 Both demo companies seeded successfully!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("  📍 Company 1 (Enterprise - All Modules):");
        console.log("     Code:     TITAN-X");
        console.log("     Email:    admin@titan.com");
        console.log("     Password: password123");
        console.log("");
        console.log("  📍 Company 2 (Growth - No HR or AI):");
        console.log("     Code:     SWIFT-LOG");
        console.log("     Email:    admin@swift.com");
        console.log("     Password: password123");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Seeding failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedCompanies();
