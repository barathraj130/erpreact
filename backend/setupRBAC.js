// backend/setupRBAC.js
import db from "./database/pg.js";

const rbacSQL = `
-- 1. ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- 3. ROLE_PERMISSIONS (The Matrix)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 4. UPDATE USERS TABLE (Add RBAC columns safely)
DO $$ 
BEGIN 
    -- Add role_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role_id') THEN
        ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);
    END IF;

    -- Add portal access column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_portal_enabled') THEN
        ALTER TABLE users ADD COLUMN is_portal_enabled BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add active status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 5. SEED INITIAL ROLES
INSERT INTO roles (name, description, is_system_role) VALUES 
('Super Admin', 'Full Access to everything', TRUE),
('Manager', 'Can manage modules but not system settings', FALSE),
('Sales Staff', 'Can only view and create orders', FALSE),
('Customer', 'External Portal Access Only', TRUE)
ON CONFLICT (name) DO NOTHING;
`;

async function runMigration() {
    console.log("🚀 Starting RBAC Database Migration...");
    try {
        await db.pool.query(rbacSQL);
        console.log("✅ Success! RBAC Tables created and Users table updated.");
    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        process.exit();
    }
}

runMigration();