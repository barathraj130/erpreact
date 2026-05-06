// backend/routes/voucherRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

/**
 * Voucher Routes for Payment, Receipt, Journal, and Contra Vouchers.
 */

// GET /api/voucher - Fetch vouchers
router.get('/', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });
    
    const { type } = req.query; // Filter by type (Payment, Receipt, etc.)

    // NOTE: Assuming a detailed voucher table exists (not explicitly in migration schema)
    // For now, we mock data.
    const mockVouchers = [
        { id: 1, voucher_number: 'P-001', voucher_type: 'Payment', date: '2024-07-25', total_amount: 5000.00, notes: 'Rent paid' },
    ];
    
    const filtered = type ? mockVouchers.filter(v => v.voucher_type === type) : mockVouchers;
    res.json(filtered);
});

module.exports = router;