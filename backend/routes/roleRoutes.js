import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// GET MATRIX DATA (Roles, Permissions, and Links)
router.get("/matrix", authMiddleware, async (req, res) => {
    try {
        // 1. Get All Roles (excluding Admin, as Admin usually has full access)
        const roles = await db.pgAll("SELECT * FROM roles WHERE name != 'admin' ORDER BY id");
        
        // 2. Get All Permissions
        const permissions = await db.pgAll("SELECT * FROM permissions ORDER BY module, id");
        
        // 3. Get Active Mappings
        const mappings = await db.pgAll("SELECT role_id, permission_id FROM role_permissions");

        res.json({ roles, permissions, mappings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load matrix" });
    }
});

// TOGGLE PERMISSION
router.post("/toggle", authMiddleware, async (req, res) => {
    const { role_id, permission_id, enabled } = req.body;

    try {
        if (enabled) {
            // Grant Permission
            await db.pgRun(
                `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [role_id, permission_id]
            );
        } else {
            // Revoke Permission
            await db.pgRun(
                `DELETE FROM role_permissions WHERE role_id=$1 AND permission_id=$2`,
                [role_id, permission_id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update permission" });
    }
});

export default router;