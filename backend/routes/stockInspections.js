// backend/routes/stockInspections.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// ─── GET /lot/:lotId  ────────────────────────────────────────────────────────
router.get('/lot/:lotId', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM stock_lot_inspections WHERE lot_id = $1 ORDER BY inspection_date DESC`,
            [req.params.lotId]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── POST /  ─────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const {
            lot_id, inspection_date, inspector_name,
            fresh_qty_inspected, fresh_passed, fresh_failed,
            mistake_qty_inspected, mistake_repairable, mistake_rejected,
            notes
        } = req.body;

        // Verify lot belongs to company
        const lot = await client.query(
            `SELECT * FROM stock_lots WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
            [lot_id, companyId]
        );
        if (!lot.rows[0]) throw new Error('Lot not found');

        // Insert inspection record
        await client.query(`
            INSERT INTO stock_lot_inspections
                (lot_id, inspection_date, inspector_name,
                 fresh_qty_inspected, fresh_passed, fresh_failed,
                 mistake_qty_inspected, mistake_repairable, mistake_rejected, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [lot_id, inspection_date || new Date(), inspector_name,
            parseInt(fresh_qty_inspected) || 0, parseInt(fresh_passed) || 0, parseInt(fresh_failed) || 0,
            parseInt(mistake_qty_inspected) || 0, parseInt(mistake_repairable) || 0,
            parseInt(mistake_rejected) || 0, notes]);

        const rejected = parseInt(mistake_rejected) || 0;
        const repairable = parseInt(mistake_repairable) || 0;
        const freshFailed = parseInt(fresh_failed) || 0;
        const lotData = lot.rows[0];

        // Move rejected mistake stock
        if (rejected > 0) {
            await client.query(`
                UPDATE stock_inventory SET
                    quantity = GREATEST(0, quantity - $1), last_updated = NOW()
                WHERE lot_id = $2 AND stock_type = 'mistake'
            `, [rejected, lot_id]);

            await client.query(`
                INSERT INTO stock_inventory (lot_id, product_id, stock_type, quantity)
                SELECT $1, product_id, 'rejected', $2 FROM stock_lots WHERE id = $1
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = stock_inventory.quantity + $2, last_updated = NOW()
            `, [lot_id, rejected]);

            await client.query(`
                INSERT INTO stock_transactions (lot_id, product_id, transaction_type, stock_type_from, quantity, notes)
                SELECT $1, product_id, 'rejection', 'mistake', $2, 'Rejected during inspection'
                FROM stock_lots WHERE id = $1
            `, [lot_id, rejected]);
        }

        // Move failed fresh stock to rejected
        if (freshFailed > 0) {
            await client.query(`
                UPDATE stock_inventory SET
                    quantity = GREATEST(0, quantity - $1), last_updated = NOW()
                WHERE lot_id = $2 AND stock_type = 'fresh_purchased'
            `, [freshFailed, lot_id]);

            await client.query(`
                INSERT INTO stock_inventory (lot_id, product_id, stock_type, quantity)
                SELECT $1, product_id, 'rejected', $2 FROM stock_lots WHERE id = $1
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = stock_inventory.quantity + $2, last_updated = NOW()
            `, [lot_id, freshFailed]);
        }

        // Determine new status
        const newStatus = repairable > 0 ? 'converting' : 'ready';

        await client.query(`
            UPDATE stock_lots SET
                status = $1,
                rejected_qty = rejected_qty + $2,
                updated_at = NOW()
            WHERE id = $3
        `, [newStatus, rejected + freshFailed, lot_id]);

        await client.query('COMMIT');
        res.json({ success: true, new_status: newStatus });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[stockInspections POST]', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

export default router;
