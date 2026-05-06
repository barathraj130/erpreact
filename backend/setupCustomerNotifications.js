import * as db from './database/pg.js';

async function run() {
    try {
        console.log("Creating customer_notifications table...");
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS customer_notifications (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                message TEXT,
                details JSONB DEFAULT '{}'::jsonb,
                is_read BOOLEAN DEFAULT false,
                is_handled BOOLEAN DEFAULT false,
                handled_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Success.");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        process.exit();
    }
}

run();
