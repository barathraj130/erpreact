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

// GET USER SPECIFIC OVERRIDES
router.get("/user/:userId", authMiddleware, async (req, res) => {
    const { userId } = req.params;
    try {
        const overrides = await db.pgAll(`SELECT permission_id, is_granted FROM user_permissions WHERE user_id = $1`, [userId]);
        res.json(overrides);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user overrides" });
    }
});

// TOGGLE USER SPECIFIC OVERRIDE
router.post("/user/toggle", authMiddleware, async (req, res) => {
    const { user_id, permission_id, is_granted, remove } = req.body;
    try {
        if (remove) {
            await db.pgRun(`DELETE FROM user_permissions WHERE user_id=$1 AND permission_id=$2`, [user_id, permission_id]);
        } else {
            await db.pgRun(`
                INSERT INTO user_permissions (user_id, permission_id, is_granted)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = EXCLUDED.is_granted
            `, [user_id, permission_id, is_granted]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update user override" });
    }
});

export default router;