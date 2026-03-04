
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

async function main() {
    try {
        console.log("Seeding...");
        const hash = await bcrypt.hash('Admin@123', 10);
        
        await pool.query("DELETE FROM users WHERE email='admin@demo.com'");
        await pool.query("DELETE FROM companies WHERE company_code='DEMO2024'");
        
        const subResult = await pool.query(
            "INSERT INTO subscriptions (plan_name, enabled_modules, status) VALUES ($1, $2, $3) RETURNING id",
            ['Enterprise', 'sales,inventory,finance,hr,ai,analytics', 'ACTIVE']
        );
        const subId = subResult.rows[0].id;
        
        const compResult = await pool.query(
            "INSERT INTO companies (company_name, company_code, subscription_id) VALUES ($1, $2, $3) RETURNING id",
            ['Demo Corp', 'DEMO2024', subId]
        );
        const compId = compResult.rows[0].id;
        
        await pool.query(
            "INSERT INTO users (company_id, active_company_id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)",
            [compId, compId, 'demo_admin_user', 'admin@demo.com', hash, 'admin']
        );
        
        console.log("✅ Credentials fixed: DEMO2024 / admin@demo.com / Admin@123");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
