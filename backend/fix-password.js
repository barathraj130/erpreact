import bcrypt from "bcryptjs";
import * as db from "./database/pg.js";

async function fix() {
    const email = "barathraj1375@gmail.com";
    const password = "pass123";
    const hashed = await bcrypt.hash(password, 10);
    
    // Find Titan Corp
    const company = await db.pgGet("SELECT id FROM companies WHERE company_code = 'TITAN-X'");
    if (!company) {
        console.log("TITAN-X company not found locally");
        return;
    }

    // Check if user exists
    const user = await db.pgGet("SELECT id FROM users WHERE email = $1", [email]);
    
    if (user) {
        await db.pgRun("UPDATE users SET password_hash = $1, failed_attempts = 0, lock_until = NULL WHERE id = $2", [hashed, user.id]);
        console.log(`✅ Updated password for ${email} to 'pass123'`);
    } else {
        await db.pgRun(
            "INSERT INTO users (company_id, active_company_id, username, email, password_hash, role, branch_id, is_active) VALUES ($1, $1, 'Adoss Manager', $2, $3, 'manager', 1, TRUE)",
            [company.id, email, hashed]
        );
        console.log(`✅ Created new user ${email} with password 'pass123' in TITAN-X`);
    }
    process.exit(0);
}

fix().catch(err => {
    console.error(err);
    process.exit(1);
});
