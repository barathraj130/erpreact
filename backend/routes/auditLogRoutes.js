// backend/routes/auditLogRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

/**
 * Audit Log Routes
 * Note: Audit logs are primarily written via the auditLogMiddleware, 
 * but this route allows authorized users to read them.
 */

// GET /api/audit-log - Fetch recent audit entries
router.get('/', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (req.user?.role !== 'admin' || !companyId) {
        return res.status(403).json({ error: "Access denied. Admin rights required." });
    }

    try {
        const limit = req.query.limit || 50;
        const sql = `
            SELECT al.*, u.username as acting_username
            FROM audit_log al
            LEFT JOIN users u ON al.user_id_acting = u.id
            WHERE u.company_id = $1
            ORDER BY al.timestamp DESC
            LIMIT $2
        `;
        const logs = await pgModule.pgAll(sql, [companyId, limit]);
        res.json(logs);
    } catch (error) {
        console.error("Error fetching audit logs:", error.message);
        res.status(500).json({ error: "Failed to retrieve audit logs." });
    }
});

module.exports = router;