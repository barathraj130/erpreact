import db from '../database/pg.js';

async function run() {
    try {
        console.log("Checking and adding constraints...");
        
        // permissions unique
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_module_action') THEN
                    ALTER TABLE permissions ADD CONSTRAINT unique_module_action UNIQUE (module, action);
                END IF;
            END $$;
        `);
        console.log("✅ Unique constraint on permissions(module, action)");

        // role_permissions unique
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_role_permission') THEN
                    ALTER TABLE role_permissions ADD CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id);
                END IF;
            END $$;
        `);
        console.log("✅ Unique constraint on role_permissions(role_id, permission_id)");

    } catch (err) {
        console.error("❌ Error fixing constraints:", err.message);
    } finally {
        process.exit(0);
    }
}

run();
