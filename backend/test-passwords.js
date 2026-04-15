
import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT u.email, u.password_hash, c.company_code 
            FROM users u 
            JOIN companies c ON u.company_id = c.id
        `);
        
        console.log("Checking passwords for found users:");
        for (const row of res.rows) {
            const isSuper = await bcrypt.compare('Super@123', row.password_hash);
            const isAdmin = await bcrypt.compare('Admin@123', row.password_hash);
            const isPass123 = await bcrypt.compare('password123', row.password_hash);
            
            let matched = 'NONE';
            if (isSuper) matched = 'Super@123';
            else if (isAdmin) matched = 'Admin@123';
            else if (isPass123) matched = 'password123';
            
            console.log(`Email: ${row.email} | Company: ${row.company_code} | Matched: ${matched}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
