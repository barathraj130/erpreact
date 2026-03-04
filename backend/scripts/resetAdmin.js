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

async function resetPassword() {
    try {
        console.log('Resetting password for admin@example.com...');
        const hashedPassword = await bcrypt.hash('Super@123', 10);
        const res = await pool.query(
            'UPDATE users SET password_hash = $1, failed_attempts = 0, lock_until = NULL WHERE email = $2', 
            [hashedPassword, 'admin@example.com']
        );
        console.log('Update result:', res.rowCount, 'rows affected.');
        console.log('Password reset to Super@123 and account unlocked.');
    } catch (e) {
        console.error('Error resetting password:', e);
    } finally {
        await pool.end();
    }
}
resetPassword();
