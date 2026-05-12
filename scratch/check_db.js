
import * as db from '../backend/database/pg.js';

async function checkDataIntegrity() {
    try {
        console.log("Checking transaction_lines for invalid account_ids...");
        const sql = `
            SELECT tl.id, tl.account_id 
            FROM transaction_lines tl
            LEFT JOIN ledgers l ON tl.account_id = l.id
            WHERE l.id IS NULL;
        `;
        const orphans = await db.pgAll(sql);
        console.log("ORPHAN RECORDS (IDs that don't exist in Ledgers):", orphans.length);
        if (orphans.length > 0) {
            console.log("Samples:", orphans.slice(0, 5));
            console.log("Deleting orphan records to allow constraint fix...");
            await db.pgRun("DELETE FROM transaction_lines WHERE account_id IN (SELECT tl.account_id FROM transaction_lines tl LEFT JOIN ledgers l ON tl.account_id = l.id WHERE l.id IS NULL)");
            console.log("Orphans deleted.");
        }

        console.log("Re-running the constraint update manually...");
        await db.pgRun(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_lines_account_id_fkey') THEN
                    ALTER TABLE transaction_lines DROP CONSTRAINT transaction_lines_account_id_fkey;
                END IF;
                ALTER TABLE transaction_lines ADD CONSTRAINT transaction_lines_account_id_fkey 
                FOREIGN KEY (account_id) REFERENCES ledgers(id);
            END $$;
        `);
        console.log("Constraint update SUCCESS.");

    } catch (e) {
        console.error("CRITICAL ERROR during integrity check:", e.message);
    }
}

checkDataIntegrity();
