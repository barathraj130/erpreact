
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
        console.log("Fixing password for admin@swift.com...");
        const hash = await bcrypt.hash('password123', 10);
        
        const res = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE email = 'admin@swift.com' RETURNING username",
            [hash]
        );
        
        if (res.rowCount > 0) {
            console.log(`✅ Password updated for ${res.rows[0].username} (admin@swift.com)`);
        } else {
            console.error("❌ User admin@swift.com not found!");
        }
    } catch (err) {
        console.error("❌ Failed to fix password:", err);
    } finally {
        await pool.end();
    }
}

run();
