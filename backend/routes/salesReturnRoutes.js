import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';

const router = express.Router();

// ── Ensure sales_returns table exists in production ───────────────────────────
const ensureTable = async () => {
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS sales_returns (
            id                      SERIAL PRIMARY KEY,
            company_id              INTEGER NOT NULL,
            branch_id               INTEGER NOT NULL DEFAULT 1,
            return_number           VARCHAR(50) NOT NULL,
            original_invoice_id     INTEGER,
            original_invoice_number VARCHAR(100),
            customer_id             INTEGER,
            customer_name           VARCHAR(255),
            return_date             DATE NOT NULL,
            items                   JSONB NOT NULL DEFAULT '[]',
            total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
            notes                   TEXT,
            refund_type             VARCHAR(30) NOT NULL DEFAULT 'CREDIT_NOTE',
            created_by              INTEGER,
            created_at              TIMESTAMP DEFAULT NOW(),
            updated_at              TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
    // Add return_amount column to invoices if missing
    await db.pgRun(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS return_amount NUMERIC(12,2) DEFAULT 0`).catch(() => {});
};

// ── helper: generate return number ────────────────────────────────────────────
async function generateReturnNumber(companyId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const row = await db.pgGet(
        `SELECT COUNT(*) AS cnt FROM sales_returns WHERE company_id = $1`,
        [companyId]
    );
    const seq = String(Number(row?.cnt || 0) + 1).padStart(3, '0');
    return `RET/${year}/${month}/${seq}`;
}

// ── GET /  – list all returns ─────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        await ensureTable();
        const rows = await db.pgAll(
            `SELECT sr.*,
                    c.username AS customer_display
             FROM sales_returns sr
             LEFT JOIN users c ON c.id = sr.customer_id
             WHERE sr.company_id = $1
             ORDER BY sr.return_date DESC, sr.created_at DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Sales returns fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch sales returns' });
    }
});

// ── GET /invoices-for-return  – invoices that can be returned ─────────────────
router.get('/invoices-for-return', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { customer_id } = req.query;
    try {
        let sql = `SELECT i.id, i.invoice_number, i.invoice_date,
                          i.total_amount, i.paid_amount, i.status,
                          u.username AS customer_name, u.id AS customer_id,
                          COALESCE(
                              (SELECT json_agg(json_build_object(
                                  'id', li.id, 'description', li.description,
                                  'quantity', li.quantity, 'unit_price', li.unit_price,
                                  'line_total', li.line_total, 'product_id', li.product_id,
                                  'gst_rate', li.gst_rate, 'hsn_code', li.hsn_code
                              )) FROM invoice_line_items li
                              WHERE li.invoice_id = i.id AND COALESCE(li.is_return, false) = false
                          ), '[]') AS line_items
                   FROM invoices i
                   LEFT JOIN users u ON u.id = i.customer_id
                   WHERE i.company_id = $1
                     AND COALESCE(i.is_deleted, false) = false
                     AND i.invoice_type NOT IN ('CREDIT_NOTE')`;
        const params = [companyId];
        if (customer_id) {
            sql += ` AND i.customer_id = $2`;
            params.push(customer_id);
        }
        sql += ` ORDER BY i.invoice_date DESC LIMIT 100`;
        const rows = await db.pgAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Invoices for return error:', err);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// ── POST /  – record a sales return ──────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const {
        original_invoice_id, customer_id, customer_name,
        return_date, items, notes, refund_type
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one return item is required' });
    }

    const processedItems = items.map(i => ({
        product_id:   i.product_id || null,
        description:  i.description || 'Returned item',
        qty:          Number(i.qty) || 0,
        rate:         Number(i.rate) || 0,
        line_total:   (Number(i.qty) || 0) * (Number(i.rate) || 0),
    }));

    const totalAmt = processedItems.reduce((s, i) => s + i.line_total, 0);
    if (totalAmt <= 0) return res.status(400).json({ error: 'Return amount must be > 0' });

    const rDate      = return_date || new Date().toISOString().split('T')[0];
    const rType      = refund_type || 'CREDIT_NOTE';

    let client;
    try {
        await ensureTable();
        client = await db.getClient();
        await client.query('BEGIN');

        // Fetch original invoice number if id provided
        let origInvNumber = null;
        let origCustomerId = customer_id || null;
        if (original_invoice_id) {
            const inv = await client.query(
                `SELECT invoice_number, customer_id FROM invoices WHERE id = $1 AND company_id = $2`,
                [original_invoice_id, companyId]
            );
            if (inv.rows[0]) {
                origInvNumber = inv.rows[0].invoice_number;
                origCustomerId = origCustomerId || inv.rows[0].customer_id;
            }
        }

        const retNumber = await generateReturnNumber(companyId);

        // Insert sales return record
        const retRow = await client.query(
            `INSERT INTO sales_returns
                (company_id, branch_id, return_number, original_invoice_id, original_invoice_number,
                 customer_id, customer_name, return_date, items, total_amount, notes, refund_type, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [companyId, branchId, retNumber, original_invoice_id || null, origInvNumber,
             origCustomerId, customer_name || null, rDate,
             JSON.stringify(processedItems), totalAmt, notes || null, rType, req.user.id]
        );
        const record = retRow.rows[0];

        // ── Return stock back to branch inventory ────────────────────────────
        for (const item of processedItems) {
            if (item.product_id && item.qty > 0) {
                await client.query(
                    `INSERT INTO branch_inventory (company_id, branch_id, product_id, quantity)
                     VALUES ($1,$2,$3,$4)
                     ON CONFLICT (company_id, branch_id, product_id)
                     DO UPDATE SET quantity = branch_inventory.quantity + EXCLUDED.quantity`,
                    [companyId, branchId, item.product_id, item.qty]
                );
            }
        }

        // ── Customer ledger: debit (reduces their outstanding) ───────────────
        if (origCustomerId) {
            try {
                await client.query(
                    `INSERT INTO customer_ledger (customer_id, company_id, date, type, description, debit, branch_id)
                     VALUES ($1,$2,$3,'SALES_RETURN',$4,$5,$6)`,
                    [origCustomerId, companyId, rDate,
                     `Sales Return ${retNumber}${origInvNumber ? ' against ' + origInvNumber : ''}`,
                     totalAmt, branchId]
                );
            } catch (e) {
                console.warn('customer_ledger insert skipped:', e.message);
            }
        }

        // ── Cash / bank ledger for actual refund ─────────────────────────────
        if (rType === 'CASH_REFUND') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1,$2,'SALES_RETURN',$3,'out',$4)`,
                [companyId, branchId, totalAmt, rDate]
            );
        } else if (rType === 'BANK_REFUND') {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                 VALUES ($1,$2,'SALES_RETURN',$3,'out','Main Account',$4,$5)`,
                [companyId, branchId, totalAmt, `RET-${record.id}`, rDate]
            );
        }
        // CREDIT_NOTE: no immediate cash/bank movement

        // ── Update original invoice return_amount ────────────────────────────
        if (original_invoice_id) {
            await client.query(
                `UPDATE invoices
                 SET return_amount = COALESCE(return_amount, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2 AND company_id = $3`,
                [totalAmt, original_invoice_id, companyId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sales return error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// ── GET /:id  – single return detail ─────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const row = await db.pgGet(
            `SELECT sr.*, c.username AS customer_display
             FROM sales_returns sr
             LEFT JOIN users c ON c.id = sr.customer_id
             WHERE sr.id = $1 AND sr.company_id = $2`,
            [req.params.id, companyId]
        );
        if (!row) return res.status(404).json({ error: 'Return not found' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch return' });
    }
});

export default router;
