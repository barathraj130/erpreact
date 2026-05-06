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
        console.log("Setting up requested logins...");
        const hash = await bcrypt.hash('Admin@123', 10);
        
        // 1. Ensure a valid subscription exists
        let subRes = await pool.query("SELECT id FROM subscriptions WHERE status='ACTIVE' LIMIT 1");
        let subId;
        if (subRes.rows.length === 0) {
            const ins_sub = await pool.query(
                "INSERT INTO subscriptions (plan_name, status, expiry_date, enabled_modules) VALUES ($1, $2, $3, $4) RETURNING id",
                ['Standard', 'ACTIVE', '2030-01-01', '["Sales", "Purchases", "Inventory", "Finance", "HR"]']
            );
            subId = ins_sub.rows[0].id;
            console.log("✅ Created active subscription");
        } else {
            subId = subRes.rows[0].id;
        }

        const companies = [
            { name: 'Fluxora Corp', code: 'FLUXORA' },
            { name: 'Akhil Enterprises', code: 'COMP-001' }
        ];

        for (const c of companies) {
            let res = await pool.query("SELECT id FROM companies WHERE LOWER(company_code) = LOWER($1)", [c.code]);
            let compId;
            if (res.rows.length === 0) {
                const ins = await pool.query(
                    "INSERT INTO companies (company_name, company_code, subscription_id, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id",
                    [c.name, c.code, subId]
                );
                compId = ins.rows[0].id;
                console.log(`✅ Created company ${c.code}`);
            } else {
                compId = res.rows[0].id;
                await pool.query("UPDATE companies SET subscription_id=$1, is_active=TRUE WHERE id=$2", [subId, compId]);
                console.log(`📍 Company ${c.code} already exists, updated subscription`);
            }

            // Create users for this company
            if (c.code === 'FLUXORA') {
                await setupUser(compId, 'Fluxora Admin', 'admin@example.com', hash);
            } else if (c.code === 'COMP-001') {
                await setupUser(compId, 'akhil', 'akhil@example.com', hash);
                // Also setup with username 'akhil' if it's not the same
                // Based on authService, username/email are checked against the same field in authenticateUser(email, ...)
            }
        }

        console.log(`✅ Requested Login Setup Complete!`);
        
    } catch (err) {
        console.error("❌ Failed to setup logins:", err);
    } finally {
        await pool.end();
    }
}

async function setupUser(compId, username, email, hash) {
    const res = await pool.query("SELECT id FROM users WHERE email=$1 OR username=$2", [email, username]);
    if (res.rows.length === 0) {
        await pool.query(
            "INSERT INTO users (company_id, active_company_id, username, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)",
            [compId, compId, username, email, hash]
        );
        console.log(`✅ Created user ${username} (${email})`);
    } else {
        await pool.query(
            "UPDATE users SET password_hash=$1, company_id=$2, active_company_id=$3, is_active=TRUE, role='admin' WHERE id=$4",
            [hash, compId, compId, res.rows[0].id]
        );
        console.log(`✅ Updated user ${username} (${email})`);
    }
}

run();
