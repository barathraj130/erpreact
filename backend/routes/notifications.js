// backend/routes/notifications.js
// Notification center — reads/writes the existing (currently unused) `notifications`
// table: id, user_id, message, is_read, created_at, type, link.
// New, additive route file — does not modify any existing route or table.
import express from "express";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import * as db from "../database/pg.js";

const router = express.Router();

// GET /api/notifications — current user's notifications
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        const rows = await db.pgAll(
            "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            [userId]
        );
        const unread = rows.filter((n) => !n.is_read).length;
        res.json({ notifications: rows, unread_count: unread });
    } catch (e) {
        console.error("Fetch notifications error:", e.message);
        res.json({ notifications: [], unread_count: 0 });
    }
});

// GET /api/notifications/unread-count
router.get("/unread-count", authMiddleware, async (req, res) => {
    try {
        const row = await db.pgGet(
            "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false",
            [req.user?.id]
        );
        res.json({ count: parseInt(row?.count) || 0 });
    } catch (e) {
        res.json({ count: 0 });
    }
});

// PUT /api/notifications/:id/read
router.put("/:id/read", authMiddleware, async (req, res) => {
    try {
        await db.pgRun(
            "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
            [req.params.id, req.user?.id]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

// PUT /api/notifications/read-all
router.put("/read-all", authMiddleware, async (req, res) => {
    try {
        await db.pgRun(
            "UPDATE notifications SET is_read = true WHERE user_id = $1",
            [req.user?.id]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

// POST /api/notifications — create a notification (defaults to the caller)
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { message, type, link, user_id } = req.body;
        if (!message) return res.status(400).json({ success: false, error: "message is required" });

        await db.pgRun(
            `INSERT INTO notifications (user_id, message, type, link)
             VALUES ($1, $2, $3, $4)`,
            [user_id || req.user?.id, message, type || "info", link || null]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

export default router;
