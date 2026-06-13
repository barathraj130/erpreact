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

/**
 * GET /api/inventory/stock-summary
 * Aggregated fresh/mistake/repaired counts from inventory table
 */
router.get('/stock-summary', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });
    try {
        const sql = `
            SELECT
                COALESCE(SUM(CASE WHEN i.stock_type = 'fresh' THEN i.quantity ELSE 0 END), 0)          AS fresh_qty,
                COALESCE(SUM(CASE WHEN i.stock_type = 'mistake' THEN i.quantity ELSE 0 END), 0)        AS mistake_qty,
                COALESCE(SUM(CASE WHEN i.stock_type = 'fresh_repaired' THEN i.quantity ELSE 0 END), 0) AS repaired_qty,
                COALESCE(SUM(i.total_cost), 0)                                                          AS total_value,
                COUNT(DISTINCT i.lot_id) FILTER (WHERE i.lot_id IS NOT NULL)                           AS active_lots
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            WHERE p.company_id = $1 AND COALESCE(p.is_deleted, false) = false AND i.quantity > 0
        `;
        const row = await pgModule.pgGet(sql, [companyId]);
        res.json(row || { fresh_qty: 0, mistake_qty: 0, repaired_qty: 0, total_value: 0, active_lots: 0 });
    } catch (err) {
        console.error('stock-summary error:', err.message);
        res.json({ fresh_qty: 0, mistake_qty: 0, repaired_qty: 0, total_value: 0, active_lots: 0 });
    }
});

/**
 * GET /api/inventory/avg-cost?product_id=&stock_type=&lot_id=
 */
router.get('/avg-cost', authMiddleware, async (req, res) => {
    const { product_id, stock_type, lot_id } = req.query;
    try {
        const params = [product_id, stock_type || 'fresh'];
        let sql = `SELECT avg_cost, quantity FROM inventory WHERE product_id = $1 AND stock_type = $2`;
        if (lot_id) { sql += ` AND lot_id = $3`; params.push(lot_id); }
        sql += ` ORDER BY last_updated DESC LIMIT 1`;
        const row = await pgModule.pgGet(sql, params);
        res.json({ avg_cost: Number(row?.avg_cost) || 0, quantity: Number(row?.quantity) || 0 });
    } catch (err) {
        res.json({ avg_cost: 0, quantity: 0 });
    }
});

/**
 * POST /api/inventory/convert  — mistake → fresh_repaired
 */
router.post('/convert', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    const { product_id, lot_id, mistake_qty, repair_cost_per_piece, notes } = req.body;
    if (!product_id || !(mistake_qty > 0)) return res.status(400).json({ error: "product_id and mistake_qty required." });
    let client;
    try {
        client = await pgModule.getClient();
        await client.query('BEGIN');

        const lotClause = lot_id ? 'AND lot_id = $2' : 'AND lot_id IS NULL';
        const lookupParams = lot_id ? [product_id, lot_id] : [product_id];
        const existing = await client.query(
            `SELECT quantity, avg_cost, total_cost FROM inventory WHERE product_id = $1 AND stock_type = 'mistake' ${lotClause} LIMIT 1`,
            lookupParams
        );
        const avail = existing.rows[0];
        if (!avail || avail.quantity < mistake_qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Not enough mistake stock. Available: ${avail?.quantity || 0}` });
        }

        const costPerPc    = Number(repair_cost_per_piece) || 0;
        const totalRepair  = costPerPc * mistake_qty;
        const mistakeAvg   = Number(avail.avg_cost) || 0;
        const newAvgCost   = mistakeAvg + costPerPc;

        // Reduce mistake row
        await client.query(
            `UPDATE inventory SET quantity = quantity - $1, total_cost = total_cost - $2, last_updated = NOW()
             WHERE product_id = $3 AND stock_type = 'mistake' ${lotClause}`,
            lot_id ? [mistake_qty, mistakeAvg * mistake_qty, product_id, lot_id]
                   : [mistake_qty, mistakeAvg * mistake_qty, product_id]
        );

        // Upsert fresh_repaired row
        if (lot_id) {
            await client.query(`
                INSERT INTO inventory (product_id, lot_id, stock_type, quantity, avg_cost, total_cost, last_updated)
                VALUES ($1, $2, 'fresh_repaired', $3, $4, $5, NOW())
                ON CONFLICT (product_id, COALESCE(branch_id,0), stock_type, COALESCE(lot_id,0))
                DO UPDATE SET
                    quantity   = inventory.quantity + $3,
                    avg_cost   = ($4 * $3 + inventory.avg_cost * inventory.quantity) / NULLIF(inventory.quantity + $3, 0),
                    total_cost = inventory.total_cost + $5,
                    last_updated = NOW()
            `, [product_id, lot_id, mistake_qty, newAvgCost, newAvgCost * mistake_qty]);
        } else {
            await client.query(`
                INSERT INTO inventory (product_id, stock_type, quantity, avg_cost, total_cost, last_updated)
                VALUES ($1, 'fresh_repaired', $2, $3, $4, NOW())
                ON CONFLICT (product_id, COALESCE(branch_id,0), stock_type, COALESCE(lot_id,0))
                DO UPDATE SET
                    quantity   = inventory.quantity + $2,
                    avg_cost   = ($3 * $2 + inventory.avg_cost * inventory.quantity) / NULLIF(inventory.quantity + $2, 0),
                    total_cost = inventory.total_cost + $4,
                    last_updated = NOW()
            `, [product_id, mistake_qty, newAvgCost, newAvgCost * mistake_qty]);
        }

        await client.query('COMMIT');
        res.json({ success: true, converted_qty: mistake_qty, repair_cost: totalRepair });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('convert error:', err.message);
        res.status(500).json({ error: 'Conversion failed: ' + err.message });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/inventory/product/:id/breakdown
 */
router.get('/product/:id/breakdown', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const rows = await pgModule.pgAll(
            `SELECT i.stock_type, i.lot_id, sl.lot_number, i.quantity, i.avg_cost, i.total_cost, i.last_updated
             FROM inventory i
             LEFT JOIN stock_lots sl ON i.lot_id = sl.id
             WHERE i.product_id = $1 AND i.quantity > 0
             ORDER BY i.stock_type, i.last_updated DESC`,
            [id]
        );
        res.json(rows || []);
    } catch (err) {
        res.json([]);
    }
});

export default router;