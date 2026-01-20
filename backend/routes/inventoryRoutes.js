// backend/routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../db/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

/**
 * Dedicated routes for stock units and stock level adjustments (separate from productRoutes)
 */

// GET /api/products/units - Fetch all stock units (used in product creation forms)
router.get('/units', checkAuth, async (req, res) => { 
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    try {
        const units = await pgModule.pgAll('SELECT * FROM stock_units WHERE company_id = $1', [companyId]);
        res.json(units);
    } catch (err) {
        console.error("Error fetching units:", err.message);
        res.status(500).json({ error: "Failed to fetch units." });
    }
});

module.exports = router;