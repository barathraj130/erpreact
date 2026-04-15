// backend/routes/productSupplierRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../db/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

// GET /api/product-suppliers/:productId - Fetch suppliers for a specific product
router.get('/:productId', checkAuth, async (req, res) => {
    const { productId } = req.params;
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    const sql = `
        SELECT ps.*, l.lender_name 
        FROM product_suppliers ps
        JOIN lenders l ON ps.supplier_id = l.id
        WHERE ps.product_id = $1
        ORDER BY ps.is_preferred DESC, l.lender_name
    `;
    
    try {
        const suppliers = await pgModule.pgAll(sql, [productId]);
        res.json(suppliers);
    } catch (error) {
        console.error("Error fetching product suppliers:", error.message);
        res.status(500).json({ error: "Failed to fetch suppliers for product." });
    }
});

module.exports = router;