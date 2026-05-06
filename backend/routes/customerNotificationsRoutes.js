import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// Get all notifications for ERP User
router.get("/", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const sql = `
            SELECT cn.*, u.username as customer_name, u.email as customer_email, u.phone as customer_phone
            FROM customer_notifications cn
            LEFT JOIN users u ON cn.customer_id = u.id
            WHERE cn.company_id = $1
            ORDER BY cn.created_at DESC
        `;
        const notifications = await db.pgAll(sql, [companyId]);
        res.json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// Mark notification as read
router.put("/:id/read", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.active_company_id;
        await db.pgRun(
            "UPDATE customer_notifications SET is_read = true WHERE id = $1 AND company_id = $2",
            [id, companyId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to mark as read" });
    }
});

// Mark all as read
router.put("/read-all", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        await db.pgRun(
            "UPDATE customer_notifications SET is_read = true WHERE company_id = $1 AND is_read = false",
            [companyId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to mark all as read" });
    }
});

// Mark notification as handled
router.put("/:id/handle", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const companyId = req.user.active_company_id;
        await db.pgRun(
            "UPDATE customer_notifications SET is_handled = true, handled_by = $1, is_read = true WHERE id = $2 AND company_id = $3",
            [userId, id, companyId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to mark as handled" });
    }
});

export default router;
