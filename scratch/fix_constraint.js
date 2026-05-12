
import * as db from '../backend/database/pg.js';

async function fixConstraint() {
    try {
        console.log("Dropping transaction_lines_account_id_fkey...");
        await db.pgRun(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_lines_account_id_fkey') THEN
                    ALTER TABLE transaction_lines DROP CONSTRAINT transaction_lines_account_id_fkey;
                    RAISE NOTICE 'Constraint dropped successfully.';
                ELSE
                    RAISE NOTICE 'Constraint did not exist.';
                END IF;
            END $$;
        `);
        console.log("✅ Done. transaction_lines.account_id is now a free integer column.");
    } catch (e) {
        console.error("Error:", e.message);
    }
}

fixConstraint();
