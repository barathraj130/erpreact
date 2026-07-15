// backend/utils/notify.js
// Helper to insert a row into the existing `notifications` table.
// New, additive utility — not called from any existing route.
import * as db from "../database/pg.js";

export const notify = async ({ user_id, message, type, link }) => {
    try {
        await db.pgRun(
            `INSERT INTO notifications (user_id, message, type, link)
             VALUES ($1, $2, $3, $4)`,
            [user_id || null, message, type || "info", link || null]
        );
    } catch (e) {
        console.error("Notify error:", e.message);
    }
};
