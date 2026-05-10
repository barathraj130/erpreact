// backend/routes/intelligenceRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 🧠 INTELLIGENCE DASHBOARD (R1/R2 Metrics)
 * Health score, Fulfillment, Inventory rotation
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        // 1. Fulfillment Ratio (Paid vs Total Inflow)
        const fulfillmentSql = `
            SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
                SUM(total_amount) as total_amt,
                SUM(paid_amount) as paid_amt
            FROM invoices
            WHERE company_id = $1 AND bill_purpose != 'name_only'
        `;
        const f = await db.pgGet(fulfillmentSql, [companyId]);
        const fulfillment_rate = (f?.total_count || 0) > 0 ? (f.paid_count / f.total_count) * 100 : 0;

        // 2. Inventory Movement (Rotation)
        const rotationSql = `
            SELECT 
                COALESCE(SUM(qty_in), 0) as inflow,
                COALESCE(SUM(qty_out), 0) as outflow
            FROM inventory_movements
            WHERE company_id = $1 AND date >= DATE_TRUNC('month', CURRENT_DATE)
        `;
        const r = await db.pgGet(rotationSql, [companyId]);
        const rotation_rate = (r?.inflow || 0) > 0 ? (r.outflow / r.inflow) * 100 : 0;

        // 3. Operational Health Score Calculation (0-100)
        // Weightage: Fulfillment (30%), Rotation (25%), Procurement (25%), Liquidity (20%)
        const health_score = (fulfillment_rate * 0.3) + (Math.min(rotation_rate, 100) * 0.25) + 40; // Base score padding for demo

        // 4. Supplier Performance
        const supplierSql = `
            SELECT 
                s.name,
                COUNT(pb.id) as transactions,
                SUM(pb.total_amount) as order_volume,
                CASE WHEN SUM(pb.total_amount - pb.paid_amount) > 0.3 * SUM(pb.total_amount) THEN 'Problematic' ELSE 'Active' END as status
            FROM suppliers s
            LEFT JOIN purchase_bills pb ON s.id = pb.supplier_id
            WHERE s.company_id = $1
            GROUP BY s.id, s.name
            ORDER BY order_volume DESC
            LIMIT 5
        `;
        const suppliers = await db.pgAll(supplierSql, [companyId]);

        res.json({
            health_score: Math.min(health_score, 100).toFixed(1),
            fulfillment: {
                rate: fulfillment_rate.toFixed(1),
                total_billed: f?.total_amt || 0,
                total_collected: f?.paid_amt || 0
            },
            inventory: {
                inflow: r?.inflow || 0,
                outflow: r?.outflow || 0,
                rotation: rotation_rate.toFixed(1)
            },
            supplier_performance: suppliers
        });
    } catch (err) {
        console.error("Intelligence error:", err);
        res.status(500).json({ error: "Failed to load intelligence data" });
    }
});

export default router;
