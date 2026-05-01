// backend/scratch/create_test_user.js
import bcrypt from "bcryptjs";
import * as db from "../database/pg.js";

async function run() {
    const company_code = "TITAN-X";
    const email = "test_selenium@titan.com";
    const username = "selenium_test_user";
    const password = "password123";

    try {
        // 1. Get Company ID
        const company = await db.pgGet("SELECT id FROM companies WHERE company_code = $1", [company_code]);
        if (!company) {
            console.error("Company not found");
            process.exit(1);
        }

        // 2. Hash Password
        const password_hash = await bcrypt.hash(password, 10);

        // 3. Delete existing user if any
        await db.pgRun("DELETE FROM users WHERE username = $1 OR email = $2", [username, email]);

        // 4. Insert User
        await db.pgRun(
            `INSERT INTO users (company_id, active_company_id, branch_id, username, email, password_hash, role, is_active)
             VALUES ($1, $1, $2, $3, $4, $5, $6, TRUE)`,
            [company.id, 1, username, email, password_hash, "admin"]
        );

        console.log(`✅ Test user created: ${email} / ${password} (Username: ${username})`);
        process.exit(0);
    } catch (err) {
        console.error("Error creating test user:", err);
        process.exit(1);
    }
}

run();
