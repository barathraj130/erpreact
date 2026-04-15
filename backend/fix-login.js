import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    port: parseInt(process.env.PG_PORT || '5432')
});

async function run() {
    try {
        console.log("Setting up TITAN-X workspace and admin@titan.com...");
        const hash = await bcrypt.hash('password123', 10);
        
        // Ensure company exists
        let compRes = await pool.query("SELECT id FROM companies WHERE company_code=$1", ['TITAN-X']);
        let compId;
        if (compRes.rows.length === 0) {
            const ins_comp = await pool.query(
                "INSERT INTO companies (company_name, company_code, status) VALUES ($1, $2, 'active') RETURNING id",
                ['Titan Systems', 'TITAN-X']
            );
            compId = ins_comp.rows[0].id;
            console.log("✅ Created company TITAN-X");
        } else {
            compId = compRes.rows[0].id;
            console.log("📍 Company TITAN-X already exists");
        }

        // Ensure user exists
        const userRes = await pool.query("SELECT id FROM users WHERE email=$1", ['admin@titan.com']);
        if (userRes.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (company_id, active_company_id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)",
                [compId, compId, 'Titan Admin', 'admin@titan.com', hash, 'superadmin']
            );
            console.log("✅ Created user admin@titan.com");
        } else {
            await pool.query(
                "UPDATE users SET password_hash=$1, active_company_id=$2, company_id=$3, role='superadmin' WHERE email=$4",
                [hash, compId, compId, 'admin@titan.com']
            );
            console.log("✅ Updated user admin@titan.com password and workspace");
        }

        console.log(`✅ Login Setup Complete!`);
        
    } catch (err) {
        console.error("❌ Failed to setup login:", err);
    } finally {
        await pool.end();
    }
}

run();
