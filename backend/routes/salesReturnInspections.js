// backend/routes/salesReturnInspections.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

async function ensureTable() {
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS sales_return_inspections (
            id                  SERIAL PRIMARY KEY,
            return_id           INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
            product_id          INTEGER REFERENCES products(id),
            company_id          INTEGER NOT NULL,
            inspection_date     DATE DEFAULT CURRENT_DATE,
            inspector_name      VARCHAR(100),
            total_qty_inspected NUMERIC(12,2) DEFAULT 0,
            good_qty            NUMERIC(12,2) DEFAULT 0,
            mistake_qty         NUMERIC(12,2) DEFAULT 0,
            rejected_qty        NUMERIC(12,2) DEFAULT 0,
            notes               TEXT,
            created_by          INTEGER,
            created_at          TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
}

// ── GET /by-return/:returnId ─────────────────────────────────────────────────
// Inspections already recorded for a return, so the UI can show graded vs pending.
router.get('/by-return/:returnId', authMiddleware, async (req, res) => {
    await ensureTable();
    try {
        const rows = await db.pgAll(
            `SELECT * FROM sales_return_inspections WHERE return_id = $1 AND company_id = $2 ORDER BY created_at DESC`,
            [req.params.returnId, req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error('GET /sales-return-inspections/by-return error:', e.message);
        res.json([]);
    }
});

// ── POST / ────────────────────────────────────────────────────────────────────
// Grades one return line item into Good (resalable as fresh) / Mistake (resold
// cheap) / Rejected (unsellable write-off). Additive to the flat branch_inventory
// credit already applied when the return was created — this also books the
// graded split into the fresh/mistake inventory buckets Branch Billing reads from.
router.post('/', authMiddleware, async (req, res) => {
    await ensureTable();
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || 1;
    const { return_id, product_id, inspector_name, inspection_date, good_qty, mistake_qty, rejected_qty, notes } = req.body;

    const good = Number(good_qty) || 0;
    const mistake = Number(mistake_qty) || 0;
    const rejected = Number(rejected_qty) || 0;
    const totalInspected = good + mistake + rejected;

    let client;
    try {
        if (totalInspected <= 0) throw new Error('Enter at least one quantity to inspect');
        if (!return_id || !product_id) throw new Error('return_id and product_id are required');

        client = await db.getClient();
        await client.query('BEGIN');

        const retRes = await client.query(
            `SELECT * FROM sales_returns WHERE id = $1 AND company_id = $2`,
            [return_id, companyId]
        );
        const ret = retRes.rows[0];
        if (!ret) throw new Error('Return not found');

        const items = Array.isArray(ret.items) ? ret.items : JSON.parse(ret.items || '[]');
        const lineItem = items.find((i) => Number(i.product_id) === Number(product_id));
        if (!lineItem) throw new Error('Return line item not found for this product');

        const alreadyRes = await client.query(
            `SELECT COALESCE(SUM(total_qty_inspected),0) AS qty FROM sales_return_inspections WHERE return_id = $1 AND product_id = $2`,
            [return_id, product_id]
        );
        const alreadyGraded = Number(alreadyRes.rows[0].qty) || 0;
        const remaining = Number(lineItem.qty) - alreadyGraded;
        if (totalInspected > remaining + 0.0001) {
            throw new Error(`Cannot inspect ${totalInspected} — only ${remaining} ungraded remaining`);
        }

        await client.query(
            `INSERT INTO sales_return_inspections
                (return_id, product_id, company_id, inspection_date, inspector_name,
                 total_qty_inspected, good_qty, mistake_qty, rejected_qty, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [return_id, product_id, companyId, inspection_date || new Date(), inspector_name || null,
                totalInspected, good, mistake, rejected, notes || null, req.user.id]
        );

        // Book the graded split into inventory's fresh/mistake buckets. rejected_qty
        // is intentionally not routed anywhere — genuinely unsellable, a write-off.
        if (good > 0) {
            await client.query(
                `INSERT INTO inventory (company_id, branch_id, product_id, product_name, current_stock, stock_type, last_updated)
                 VALUES ($1,$2,$3,$4,$5,'fresh',NOW())
                 ON CONFLICT (product_id, COALESCE(branch_id,0), stock_type, COALESCE(lot_id,0))
                 DO UPDATE SET current_stock = inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()`,
                [companyId, branchId, product_id, lineItem.description, good]
            );
        }
        if (mistake > 0) {
            await client.query(
                `INSERT INTO inventory (company_id, branch_id, product_id, product_name, current_stock, stock_type, last_updated)
                 VALUES ($1,$2,$3,$4,$5,'mistake',NOW())
                 ON CONFLICT (product_id, COALESCE(branch_id,0), stock_type, COALESCE(lot_id,0))
                 DO UPDATE SET current_stock = inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()`,
                [companyId, branchId, product_id, lineItem.description, mistake]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, good, mistake, rejected });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('POST /sales-return-inspections error:', e.message);
        res.status(400).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
