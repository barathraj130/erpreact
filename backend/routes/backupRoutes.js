// backend/routes/backupRoutes.js
import express from "express";
import { authMiddleware, checkAuth } from "../middlewares/jwtAuthMiddleware.js";
import * as backupService from "../services/backupService.js";

const router = express.Router();

// Protect all routes
router.use(authMiddleware);
router.use(checkAuth);

/**
 * POST /api/backups/create
 * Manually trigger backup
 */
router.post("/create", async (req, res) => {
    try {
        const { user } = req;

        // Check admin role
        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const backup = await backupService.createDailyBackup(user.company_id);
        res.json({ success: true, data: backup });
    } catch (err) {
        console.error("❌ Create backup error:", err);
        res.status(500).json({ error: "Failed to create backup" });
    }
});

/**
 * GET /api/backups/list
 * List all backups
 */
router.get("/list", async (req, res) => {
    try {
        const { user } = req;

        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const backups = await backupService.listBackups(user.company_id);
        res.json({ success: true, data: backups });
    } catch (err) {
        console.error("❌ List backups error:", err);
        res.status(500).json({ error: "Failed to fetch backups" });
    }
});

/**
 * POST /api/backups/:id/restore
 * Restore from backup
 */
router.post("/:id/restore", async (req, res) => {
    try {
        const { user } = req;
        const { id } = req.params;

        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const result = await backupService.restoreFromBackup(id, user.company_id, user.id);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error("❌ Restore backup error:", err);
        res.status(500).json({ error: "Failed to restore backup" });
    }
});

/**
 * GET /api/backups/stats
 * Get backup statistics
 */
router.get("/stats", async (req, res) => {
    try {
        const { user } = req;

        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const stats = await backupService.getBackupStats(user.company_id);
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error("❌ Get backup stats error:", err);
        res.status(500).json({ error: "Failed to fetch backup stats" });
    }
});

/**
 * POST /api/backups/cleanup
 * Clean up old backups
 */
router.post("/cleanup", async (req, res) => {
    try {
        const { user } = req;
        const { keepCount = 10 } = req.body;

        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const result = await backupService.cleanupOldBackups(user.company_id, keepCount);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error("❌ Cleanup backups error:", err);
        res.status(500).json({ error: "Failed to cleanup backups" });
    }
});

/**
 * GET /api/backups/export
 * Export company data as JSON
 */
router.get("/export", async (req, res) => {
    try {
        const { user } = req;

        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const data = await backupService.exportCompanyData(user.company_id);
        
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="company_export_${user.company_id}_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(data);
    } catch (err) {
        console.error("❌ Export data error:", err);
        res.status(500).json({ error: "Failed to export data" });
    }
});

export default router;
