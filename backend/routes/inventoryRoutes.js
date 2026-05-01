// backend/routes/inventoryRoutes.js
import express from 'express';
import * as pgModule from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * GET /api/inventory/units - Fetch all stock units
 */
router.get('/units', authMiddleware, async (req, res) => { 
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    try {
        const units = await pgModule.pgAll('SELECT * FROM stock_units WHERE company_id = $1 AND is_deleted = false', [companyId]);
        res.json(units);
    } catch (err) {
        console.error("Error fetching units:", err.message);
        res.status(500).json({ error: "Failed to fetch units." });
    }
});

/**
 * Archive Stock Unit
 */
router.patch('/units/:id/archive', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    try {
        const result = await pgModule.pgGet(
            'UPDATE stock_units SET is_deleted = true, deleted_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING id',
            [id, companyId]
        );
        if (!result) return res.status(404).json({ error: "Unit not found" });
        res.json({ message: "Unit archived successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to archive unit" });
    }
});

export default router;