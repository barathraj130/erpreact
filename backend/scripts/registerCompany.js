// backend/scripts/registerCompany.js
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
});

async function registerNewCompany(name, code, adminEmail, password) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log(`🚀 Registering Company: ${name} (${code})...`);

        // 1. Create Company
        const compRes = await client.query(
            "INSERT INTO companies (company_name, company_code, is_active) VALUES ($1, $2, TRUE) RETURNING id",
            [name, code]
        );
        const companyId = compRes.rows[0].id;

        // 2. Create Default Branch for Company
        const branchRes = await client.query(
            "INSERT INTO branches (company_id, branch_name, is_active) VALUES ($1, 'Main Branch', TRUE) RETURNING id",
            [companyId]
        );
        const branchId = branchRes.rows[0].id;

        // 3. Create Admin User for this Company
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query(
            `INSERT INTO users (company_id, branch_id, active_company_id, username, email, password_hash, role, is_active) 
             VALUES ($1, $2, $1, $3, $4, $5, 'admin', TRUE)`,
            [companyId, branchId, adminEmail.split('@')[0], adminEmail, hashedPassword]
        );

        await client.query('COMMIT');
        console.log(`✅ Success!`);
        console.log(`-----------------------------------`);
        console.log(`Company ID: ${companyId}`);
        console.log(`Company Code: ${code}`);
        console.log(`Admin Login: ${adminEmail}`);
        console.log(`Password: ${password}`);
        console.log(`-----------------------------------`);
        console.log(`You can now log in at http://localhost:5173/login`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error registering company:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

// Get arguments from CLI
const args = process.argv.slice(2);
if (args.length < 4) {
    console.log("Usage: node registerCompany.js <CompanyName> <CompanyCode> <AdminEmail> <AdminPassword>");
    console.log("Example: node registerCompany.js \"Globex Corp\" GLOB-001 admin@globex.com secret123");
    process.exit(1);
}

registerNewCompany(args[0], args[1], args[2], args[3]);
