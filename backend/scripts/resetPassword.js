// backend/scripts/resetPassword.js
const bcrypt = require('bcryptjs');
const pgModule = require('../database/pg');
require('dotenv').config();

// Usage: node backend/scripts/resetPassword.js <username> <new_password>
const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
    console.log("Usage: node backend/scripts/resetPassword.js <username> <new_password>");
    process.exit(0);
}

async function resetUserPassword() {
    console.log(`Attempting to reset password for user: ${username}`);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    try {
        const sql = `UPDATE users SET password = $1 WHERE username = $2 RETURNING id`;
        const result = await pgModule.pgRun(sql, [hashedPassword, username]);

        if (result.changes === 0) {
            console.error(`❌ User '${username}' not found.`);
            process.exit(1);
        }

        console.log(`✅ Password for user '${username}' reset successfully.`);

    } catch (err) {
        console.error("❌ Failed to reset password:", err.message);
        process.exit(1);
    } finally {
        // Ensure the connection pool is closed after execution
        if (pgModule.pool) {
            pgModule.pool.end();
        }
    }
}

resetUserPassword();