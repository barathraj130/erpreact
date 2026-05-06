import bcrypt from 'bcryptjs';
import db from '../database/pg.js';

async function seedPlatform() {
    try {
        console.log("🌱 Seeding Multi-Tenant Platform Demo Data...");

        // 1. Create Subscriptions
        const subRes1 = await db.pool.query(
            "INSERT INTO subscriptions (plan_name, max_branches, max_users, enabled_modules, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            ['Enterprise Plus', 10, 50, 'sales,finance,inventory,hr,ai,reports', 'ACTIVE']
        );
        const enterpriseSubId = subRes1.rows[0].id;

        const subRes2 = await db.pool.query(
            "INSERT INTO subscriptions (plan_name, max_branches, max_users, enabled_modules, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            ['Growth Plan', 3, 10, 'sales,finance,inventory,reports', 'ACTIVE']
        );
        const growthSubId = subRes2.rows[0].id;

        // 2. Create Companies
        const comp1 = await db.pool.query(
            "INSERT INTO companies (company_name, company_code, subscription_id) VALUES ($1, $2, $3) RETURNING id",
            ['Titan Corp', 'TITAN-X', enterpriseSubId]
        );
        const titanId = comp1.rows[0].id;

        const comp2 = await db.pool.query(
            "INSERT INTO companies (company_name, company_code, subscription_id) VALUES ($1, $2, $3) RETURNING id",
            ['Swift Logistics', 'SWIFT-LOG', growthSubId]
        );
        const swiftId = comp2.rows[0].id;

        // 3. Create Branches
        const titanBranches = [
            ['Titan HQ', 'HQ-01'],
            ['Titan Manufacturing', 'MFG-02'],
            ['Titan R&D', 'RND-03']
        ];
        for (const [name, code] of titanBranches) {
            await db.pool.query("INSERT INTO branches (company_id, branch_name, branch_code) VALUES ($1, $2, $3)", [titanId, name, code]);
        }

        const swiftBranches = [
            ['Main Hub', 'HUB-01'],
            ['Regional DEPOT', 'DEP-02']
        ];
        for (const [name, code] of swiftBranches) {
            await db.pool.query("INSERT INTO branches (company_id, branch_name, branch_code) VALUES ($1, $2, $3)", [swiftId, name, code]);
        }

        // 4. Create Users
        const hp = await bcrypt.hash('password123', 10);
        
        // Titan Admin
        await db.pool.query(`
            INSERT INTO users (company_id, branch_id, username, email, password_hash, role) 
            VALUES ($1, (SELECT id FROM branches WHERE company_id = $1 LIMIT 1), $2, $3, $4, $5)`,
            [titanId, 'titan_admin', 'admin@titan.com', hp, 'admin']
        );

        // Swift Admin
        await db.pool.query(`
            INSERT INTO users (company_id, branch_id, username, email, password_hash, role) 
            VALUES ($1, (SELECT id FROM branches WHERE company_id = $1 LIMIT 1), $2, $3, $4, $5)`,
            [swiftId, 'swift_admin', 'admin@swift.com', hp, 'admin']
        );

        console.log("✅ Platform seeded with demo tenants and branches.");
        console.log("   - Titan Corp (TITAN-X): admin@titan.com / password123 [ALL MODULES]");
        console.log("   - Swift Logistics (SWIFT-LOG): admin@swift.com / password123 [NO HR/AI]");

    } catch (err) {
        console.error("❌ Seeding failed:", err);
    } finally {
        process.exit();
    }
}

seedPlatform();
