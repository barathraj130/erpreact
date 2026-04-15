// backend/repairSystem.js
import bcrypt from "bcryptjs";
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from "./config/permissionsConfig.js";
import db from "./database/pg.js";

async function repair() {
    console.log("\n🔧 STARTING SYSTEM REPAIR...\n");

    try {
        // 1. SYNC ROLES
        console.log("1️⃣  Syncing Roles...");
        for (const role of SYSTEM_ROLES) {
            await db.pgRun(`INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [role]);
        }

        // 2. SYNC PERMISSIONS
        console.log("2️⃣  Syncing Permissions...");
        for (const p of SYSTEM_PERMISSIONS) {
            // Check if exists manually to avoid complex unique constraint issues
            const check = await db.pgGet(`SELECT id FROM permissions WHERE module=$1 AND action=$2`, [p.module, p.action]);
            if (!check) {
                await db.pgRun(
                    `INSERT INTO permissions (module, action, description) VALUES ($1, $2, $3)`,
                    [p.module, p.action, p.description]
                );
            }
        }

        // 3. GRANT PERMISSIONS TO MANAGER (So Akhil isn't empty)
        console.log("3️⃣  Granting Defaults to Manager...");
        const managerRole = await db.pgGet("SELECT id FROM roles WHERE name = 'manager'");
        if (managerRole) {
            // Give Sales, Purchases, Inventory access
            await db.pgRun(`
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT $1, id FROM permissions 
                WHERE module IN ('Sales', 'Purchases', 'Inventory')
                ON CONFLICT DO NOTHING
            `, [managerRole.id]);
        }

        // 4. FIX USER 'AKHIL'
        console.log("4️⃣  Fixing User 'akhil'...");
        // Ensure user exists or update him
        const hashed = await bcrypt.hash("akhil", 10); // Password is "akhil"
        
        // Check if exists
        const user = await db.pgGet("SELECT id FROM users WHERE username = 'akhil'");
        
        if (user) {
            // Update existing
            await db.pgRun(
                `UPDATE users SET password_hash=$1, role='manager', active_company_id=1 WHERE id=$2`,
                [hashed, user.id]
            );
            console.log("   ✅ User 'akhil' updated (Role: Manager, Pass: akhil)");
        } else {
            // Create new
            await db.pgRun(
                `INSERT INTO users (username, email, password_hash, role, active_company_id) 
                 VALUES ('akhil', 'akhil@test.com', $1, 'manager', 1)`,
                [hashed]
            );
            console.log("   ✅ User 'akhil' created (Role: Manager, Pass: akhil)");
        }

        console.log("\n✅ REPAIR COMPLETE. You can now log in.");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ ERROR:", err);
        process.exit(1);
    }
}

repair();