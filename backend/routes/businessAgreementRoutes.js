// backend/routes/businessAgreementRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

// GET all agreements
router.get('/', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    const sql = `
        SELECT ba.*, l.lender_name 
        FROM business_agreements ba
        JOIN lenders l ON ba.lender_id = l.id
        WHERE ba.company_id = $1
        ORDER BY ba.start_date DESC
    `;
    try {
        const agreements = await pgModule.pgAll(sql, [companyId]);
        res.json(agreements);
    } catch (error) {
        console.error("Error fetching agreements:", error.message);
        res.status(500).json({ error: "Failed to fetch agreements." });
    }
});

module.exports = router;