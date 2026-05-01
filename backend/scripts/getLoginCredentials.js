// Script to get or create login credentials
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT
});

async function setupLoginCredentials() {
    let client;
    try {
        client = await pool.connect();
        
        console.log('\n🔍 Checking existing data...\n');
        
        // Check for existing companies
        const companies = await client.query('SELECT * FROM companies ORDER BY id LIMIT 5');
        const users = await client.query('SELECT * FROM users ORDER BY id LIMIT 10');
        
        if (companies.rows.length === 0) {
            console.log('📦 No companies found. Creating demo setup...\n');
            
            await client.query('BEGIN');
            
            // 1. Create subscription
            const subResult = await client.query(`
                INSERT INTO subscriptions 
                (plan_name, max_branches, max_users, enabled_modules, expiry_date, status)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `, ['Enterprise', 10, 100, 'sales,inventory,finance,hr,ai,analytics', '2027-12-31', 'ACTIVE']);
            
            const subscriptionId = subResult.rows[0].id;
            
            // 2. Create company
            const compResult = await client.query(`
                INSERT INTO companies 
                (company_name, company_code, subscription_id, is_active)
                VALUES ($1, $2, $3, TRUE)
                RETURNING id
            `, ['Demo Corporation', 'DEMO2024', subscriptionId]);
            
            const companyId = compResult.rows[0].id;
            
            // 3. Create default branch
            const branchResult = await client.query(`
                INSERT INTO branches 
                (company_id, branch_name, branch_code, is_active)
                VALUES ($1, $2, $3, TRUE)
                RETURNING id
            `, [companyId, 'Main Office', 'MAIN-01']);
            
            const branchId = branchResult.rows[0].id;
            
            // 4. Create admin user
            const hashedPassword = await bcrypt.hash('Admin@123', 10);
            await client.query(`
                INSERT INTO users 
                (company_id, active_company_id, branch_id, username, email, password_hash, role)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [companyId, companyId, branchId, 'admin', 'admin@demo.com', hashedPassword, 'admin']);
            
            // 5. Create superadmin user
            const superHashedPassword = await bcrypt.hash('Super@123', 10);
            await client.query(`
                INSERT INTO users 
                (company_id, active_company_id, branch_id, username, email, password_hash, role)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [companyId, companyId, branchId, 'superadmin', 'super@demo.com', superHashedPassword, 'superadmin']);
            
            await client.query('COMMIT');
            
            console.log('✅ Demo setup created successfully!\n');
        }
        
        // Display login credentials
        const finalCompanies = await client.query(`
            SELECT c.*, s.plan_name, s.enabled_modules 
            FROM companies c 
            LEFT JOIN subscriptions s ON c.subscription_id = s.id 
            ORDER BY c.id
        `);
        
        const finalUsers = await client.query(`
            SELECT u.username, u.email, u.role, c.company_code, c.company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            ORDER BY u.id
        `);
        
        console.log('═'.repeat(80));
        console.log('🔐 LOGIN CREDENTIALS FOR YOUR ERP PLATFORM');
        console.log('═'.repeat(80));
        console.log('\n📍 Platform URL: http://localhost:5173/login\n');
        
        finalUsers.rows.forEach((user, index) => {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`\n${index + 1}. ${user.role.toUpperCase()} LOGIN`);
            console.log(`\n   Company Code: ${user.company_code}`);
            console.log(`   Email:        ${user.email}`);
            console.log(`   Password:     ${user.role === 'superadmin' ? 'Super@123' : 'Admin@123'}`);
            console.log(`   Role:         ${user.role}`);
            console.log(`   Company:      ${user.company_name}`);
            
            if (user.role === 'superadmin') {
                console.log(`\n   ⭐ After login, access Platform Nexus at: /platform-admin`);
            }
        });
        
        console.log(`\n${'─'.repeat(80)}\n`);
        console.log('💡 QUICK START:\n');
        console.log('   1. Open http://localhost:5173/login');
        console.log('   2. Use any credentials above');
        console.log('   3. For SuperAdmin: Go to /platform-admin to onboard new companies');
        console.log('   4. For Admin: Access full ERP workspace\n');
        console.log('═'.repeat(80));
        
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

setupLoginCredentials();
