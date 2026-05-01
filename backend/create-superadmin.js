
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    user: process.env.PG_USER || 'erpuser',
    password: process.env.PG_PASSWORD || 'erp123',
    host: process.env.PG_HOST || '127.0.0.1',
    database: process.env.PG_DATABASE || 'erpdb',
    port: parseInt(process.env.PG_PORT || '5432')
});

async function run() {
    try {
        console.log("Creating Super Admin...");
        const hash = await bcrypt.hash('Super@123', 10);
        
        // Find a company to attach to (SuperAdmin still needs a company context for some routes)
        const compRes = await pool.query("SELECT id, company_code FROM companies WHERE company_code='FLUXORA' OR company_code='DEMO2024' LIMIT 1");
        
        if (compRes.rows.length === 0) {
            console.error("❌ No companies found to attach Super Admin to. Run seeding first.");
            process.exit(1);
        }
        
        const compId = compRes.rows[0].id;
        const compCode = compRes.rows[0].company_code;

        await pool.query("DELETE FROM users WHERE email='superadmin@platform.com'");
        await pool.query(
            "INSERT INTO users (company_id, active_company_id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)",
            [compId, compId, 'super_admin_v2', 'superadmin@platform.com', hash, 'superadmin']
        );
        
        console.log(`✅ Super Admin created successfully!`);
        console.log(`📍 Workspace ID: ${compCode}`);
        console.log(`📍 Email:        superadmin@platform.com`);
        console.log(`📍 Password:     Super@123`);
        
    } catch (err) {
        console.error("❌ Failed to create Super Admin:", err);
    } finally {
        await pool.end();
    }
}

run();
