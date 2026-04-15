// backend/routes/salesOrderRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

// GET /api/sales-orders
router.get('/', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    // Assuming a simplified sales_orders table exists
    const sql = `
        SELECT so.*, u.username as customer_name
        FROM sales_orders so 
        LEFT JOIN users u ON so.customer_id = u.id 
        WHERE so.company_id = $1
        ORDER BY so.order_date DESC
    `;
    
    try {
        // NOTE: We need to create the sales_orders table in run-migrations.js
        // Since it's not explicitly in the final schema, we use mock data here.
        const mockOrders = [
            { id: 1, order_number: 'SO-001', customer_name: 'Mock Customer', order_date: '2024-07-20', total_value: 12500.50, status: 'Confirmed' },
        ];
        // const orders = await pgModule.pgAll(sql, [companyId]); 
        res.json(mockOrders);
    } catch (error) {
        console.error("Failed to fetch sales orders:", error.message);
        res.status(500).json({ error: "Failed to fetch sales orders." });
    }
});

module.exports = router;