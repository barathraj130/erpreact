// backend/database/seedPermissions.js
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "../config/permissionsConfig.js";
import * as db from "./pg.js";

export const seedPermissions = async () => {
    console.log("⚙️  Syncing Permissions Matrix...");

    try {
        // 1. Ensure Roles Exist
        for (const role of SYSTEM_ROLES) {
            await db.pgRun(
                `INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
                [role]
            );
        }

        // 2. Ensure Permissions Exist
        for (const p of ALL_PERMISSIONS) {
            const check = await db.pgGet(
                `SELECT id FROM permissions WHERE module=$1 AND action=$2`, 
                [p.module, p.action]
            );
            
            if (!check) {
                await db.pgRun(
                    `INSERT INTO permissions (module, action, description) VALUES ($1, $2, $3)`,
                    [p.module, p.action, p.description]
                );
                console.log(`   ➕ Created Permission: ${p.action}`);
            }
        }

        // 3. FORCE ADMIN TO HAVE ALL PERMISSIONS (Safety Net)
        const adminRole = await db.pgGet("SELECT id FROM roles WHERE name = 'admin'");
        if (adminRole) {
            await db.pgRun(`
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT $1, id FROM permissions
                ON CONFLICT DO NOTHING
            `, [adminRole.id]);
        }

        console.log("✅ Permissions & Roles Synced.");

    } catch (err) {
        console.error("❌ Permission Sync Error:", err);
    }
};