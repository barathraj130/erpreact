import bcrypt from 'bcryptjs';
import db from '../database/pg.js'; // Imports from your existing PG connection

// Get arguments from command line
const args = process.argv.slice(2);
const username = args[0] || 'admin';
const email = args[1] || 'admin@example.com';
const password = args[2] || 'admin123';

async function createAdminUser() {
    console.log(`Creating admin user: ${username} / ${password}`);
    
    let client;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Get client from the exported pool object
        client = await db.pool.connect();
        await client.query('BEGIN');
        
        // 1. Ensure default company exists
        await client.query(`
            INSERT INTO companies (id, company_name, gstin) 
            VALUES (1, 'Default System Company', 'ADMIN_COMPANY')
            ON CONFLICT (id) DO NOTHING
        `);

        // 2. Upsert Admin User
        const userSql = `
            INSERT INTO users (company_id, username, email, password_hash, role, active_company_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username) 
            DO UPDATE SET 
                email = EXCLUDED.email, 
                password_hash = EXCLUDED.password_hash, 
                role = 'admin', 
                active_company_id = $6
            RETURNING id
        `;
        
        const userResult = await client.query(userSql, [
            1, username, email, hashedPassword, 'admin', 1
        ]);
        
        console.log(`✅ Success! User ID: ${userResult.rows[0].id}`);
        await client.query('COMMIT');

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Failed:", err.message);
    } finally {
        if (client) client.release();
        // Force exit to close the pool
        process.exit(0);
    }
}

createAdminUser();