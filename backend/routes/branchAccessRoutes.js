// backend/routes/branchAccessRoutes.js
//
// Lets a tenant admin open a branch's billing dashboard as that branch's
// manager, in a new tab, without re-entering credentials. A single-use,
// short-lived token is minted server-side and exchanged for a real JWT —
// the same JWT shape authService.generateTokens already produces, so every
// existing authMiddleware-protected route accepts it unchanged.
//
// New table only (branch_access_tokens); no existing table, route, or
// auth logic is touched.
import express from "express";
import crypto from "crypto";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { generateTokens } from "../services/authService.js";

const router = express.Router();

const isAdminRole = (role) => ["admin", "superadmin"].includes((role || "").toLowerCase());

// POST /api/branch-access/generate — admin mints a token for one branch
router.post("/generate", authMiddleware, async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: "Admin only" });
        }

        const { branch_id } = req.body;
        if (!branch_id) return res.json({ success: false, error: "branch_id is required" });

        const companyId = req.user.active_company_id;
        const branch = await db.pgGet(
            `SELECT id, branch_name, manager_user_id, manager_name FROM branches WHERE id = $1 AND company_id = $2`,
            [branch_id, companyId]
        );
        if (!branch) return res.json({ success: false, error: "Branch not found" });
        if (!branch.manager_user_id) {
            return res.json({
                success: false,
                error: `No branch manager login is linked to ${branch.branch_name}. Assign one on the branch's edit screen first.`,
            });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

        await db.pgRun(
            `INSERT INTO branch_access_tokens
                (token, admin_user_id, branch_id, company_id, branch_user_id, expires_at, ip_address, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [token, req.user.id, branch_id, companyId, branch.manager_user_id, expiresAt, req.ip,
             `Admin #${req.user.id} opened branch ${branch.branch_name}`]
        );

        res.json({
            success: true,
            token,
            branch_name: branch.branch_name,
            manager_name: branch.manager_name,
            expires_at: expiresAt,
            redirect_path: `/branch-access/${token}`,
        });
    } catch (e) {
        console.error("branch-access generate error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// POST /api/branch-access/redeem — the new tab exchanges the one-time token
// for a real, wrapped JWT (authMiddleware-compatible) as the branch manager.
// No auth required here — the token itself is the one-time secret.
router.post("/redeem", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.json({ success: false, error: "Token required" });

        const tokenRow = await db.pgGet(
            `SELECT bat.*, b.branch_name
             FROM branch_access_tokens bat
             JOIN branches b ON b.id = bat.branch_id
             WHERE bat.token = $1 AND bat.is_used = false AND bat.expires_at > NOW()`,
            [token]
        );
        if (!tokenRow) {
            return res.json({ success: false, error: "Invalid or expired access link. Ask the admin to open it again." });
        }

        await db.pgRun(
            `UPDATE branch_access_tokens SET is_used = true, used_at = NOW() WHERE id = $1`,
            [tokenRow.id]
        );

        const branchUser = await db.pgGet(`SELECT * FROM users WHERE id = $1`, [tokenRow.branch_user_id]);
        if (!branchUser) return res.json({ success: false, error: "The linked branch manager account no longer exists." });

        const company = await db.pgGet(
            `SELECT c.company_name, s.status AS sub_status, s.enabled_modules
             FROM companies c LEFT JOIN subscriptions s ON c.subscription_id = s.id
             WHERE c.id = $1`,
            [tokenRow.company_id]
        );
        const permissions = await db.pgAll(
            `SELECT p.module, p.action FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             JOIN roles r ON rp.role_id = r.id
             WHERE LOWER(r.name) = LOWER($1)`,
            [branchUser.role || "user"]
        );

        const { accessToken } = generateTokens({
            id: branchUser.id,
            email: branchUser.email,
            username: branchUser.username,
            role: branchUser.role,
            company_id: tokenRow.company_id,
            company_name: company?.company_name,
            branch_id: tokenRow.branch_id,
            subscription_status: company?.sub_status,
            enabled_modules: company?.enabled_modules,
            permissions,
        });

        res.json({
            success: true,
            token: accessToken,
            branch_name: tokenRow.branch_name,
            expires_in_ms: 4 * 60 * 60 * 1000,
        });
    } catch (e) {
        console.error("branch-access redeem error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// GET /api/branch-access/history — admin audit trail of who opened what, when
router.get("/history", authMiddleware, async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ error: "Admin only" });
        }
        const rows = await db.pgAll(
            `SELECT bat.id, bat.created_at, bat.expires_at, bat.used_at, bat.is_used, bat.ip_address,
                    admin.username AS admin_name, b.branch_name, mgr.username AS manager_name
             FROM branch_access_tokens bat
             LEFT JOIN users admin ON admin.id = bat.admin_user_id
             LEFT JOIN branches b ON b.id = bat.branch_id
             LEFT JOIN users mgr ON mgr.id = bat.branch_user_id
             WHERE bat.company_id = $1
             ORDER BY bat.created_at DESC
             LIMIT 100`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("branch-access history error:", e.message);
        res.json([]);
    }
});

export default router;
