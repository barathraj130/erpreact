import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';
import { ensureCustomerLedgerMetadata, recomputeCustomerBalance } from '../services/customerLedgerService.js';

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
    // Track how much of a credit note has been applied to new invoices
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS applied_amount NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    // GST breakdown on the return — total_amount already includes this when the
    // original invoice was a TAX invoice (see isGSTInvoice below); items stay JSONB,
    // there is no separate sales_return_items table in this schema.
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS total_taxable_amount NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS total_cgst NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS total_sgst NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS total_igst NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS total_gst_amount NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS is_gst_return BOOLEAN DEFAULT false`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS original_invoice_type VARCHAR(30)`).catch(() => {});
    await db.pgRun(`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS customer_state_code VARCHAR(5)`).catch(() => {});
};

// Invoice types that do NOT carry GST — matches the exclusion list already used
// by customerLedgerService.js for the same distinction elsewhere in this app.
const NON_GST_INVOICE_TYPES = ['NON_TAX_INVOICE', 'RETAIL_SALE', 'GIFTED_ITEM', 'NSB_INVOICE'];
const isGSTInvoiceType = (invoiceType) => !NON_GST_INVOICE_TYPES.includes(String(invoiceType || '').toUpperCase());

/**
 * Computes taxable/CGST/SGST/IGST/total for one return line item, given the
 * original invoice's GST-applicability and the buyer/seller state comparison —
 * same split logic as invoicePdfRoutes.js uses when the invoice was created.
 */
function computeItemTax(item, { isGSTInvoice, isSameState }) {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const taxable = qty * rate;
    const gstRate = isGSTInvoice ? (Number(item.gst_rate) || 0) : 0;
    const gstAmount = taxable * gstRate / 100;

    let cgst = 0, sgst = 0, igst = 0;
    if (gstAmount > 0) {
        if (isSameState) { cgst = gstAmount / 2; sgst = gstAmount / 2; }
        else { igst = gstAmount; }
    }

    return {
        product_id: item.product_id || null,
        description: item.description || 'Returned item',
        qty, rate,
        taxable_amount: taxable,
        gst_rate: gstRate,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_gst_amount: gstAmount,
        line_total: taxable + gstAmount,
    };
}

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
        let sql = `SELECT i.id, i.invoice_number, i.invoice_date, i.invoice_type,
                          i.total_amount, i.paid_amount, i.status,
                          u.username AS customer_name, u.id AS customer_id,
                          u.state_code AS customer_state_code,
                          c2.state_code AS company_state_code,
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
                   LEFT JOIN companies c2 ON c2.id = i.company_id
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

    const rDate      = return_date || new Date().toISOString().split('T')[0];
    const rType      = refund_type || 'CREDIT_NOTE';

    let client;
    try {
        await ensureTable();
        client = await db.getClient();
        await client.query('BEGIN');

        // Fetch original invoice + GST context (type, buyer/seller state) if id provided.
        // GST applicability and the CGST+SGST vs IGST split are both determined server-side
        // from the real invoice — never trusted from the client — matching how invoicePdfRoutes.js
        // computes the same split when the invoice was originally created.
        let origInvNumber = null;
        let origCustomerId = customer_id || null;
        let isGSTInvoice = false;
        let isSameState = true;
        let originalInvoiceType = null;
        let customerStateCode = null;
        if (original_invoice_id) {
            const inv = await client.query(
                `SELECT i.invoice_number, i.customer_id, i.invoice_type,
                        u.state_code AS customer_state_code, c2.state_code AS company_state_code
                 FROM invoices i
                 LEFT JOIN users u ON u.id = i.customer_id
                 LEFT JOIN companies c2 ON c2.id = i.company_id
                 WHERE i.id = $1 AND i.company_id = $2`,
                [original_invoice_id, companyId]
            );
            if (inv.rows[0]) {
                origInvNumber = inv.rows[0].invoice_number;
                origCustomerId = origCustomerId || inv.rows[0].customer_id;
                originalInvoiceType = inv.rows[0].invoice_type;
                customerStateCode = inv.rows[0].customer_state_code || null;
                isGSTInvoice = isGSTInvoiceType(originalInvoiceType);
                isSameState = (inv.rows[0].company_state_code || '33') === (customerStateCode || '33');
            }
        }

        const processedItems = items.map((i) => computeItemTax(i, { isGSTInvoice, isSameState }));

        const totalTaxable = processedItems.reduce((s, i) => s + i.taxable_amount, 0);
        const totalCGST = processedItems.reduce((s, i) => s + i.cgst_amount, 0);
        const totalSGST = processedItems.reduce((s, i) => s + i.sgst_amount, 0);
        const totalIGST = processedItems.reduce((s, i) => s + i.igst_amount, 0);
        const totalGST = processedItems.reduce((s, i) => s + i.total_gst_amount, 0);
        const totalAmt = processedItems.reduce((s, i) => s + i.line_total, 0);
        if (totalAmt <= 0) throw new Error('Return amount must be > 0');

        const retNumber = await generateReturnNumber(companyId);

        // Insert sales return record
        const retRow = await client.query(
            `INSERT INTO sales_returns
                (company_id, branch_id, return_number, original_invoice_id, original_invoice_number,
                 customer_id, customer_name, return_date, items, total_amount, notes, refund_type, created_by,
                 total_taxable_amount, total_cgst, total_sgst, total_igst, total_gst_amount,
                 is_gst_return, original_invoice_type, customer_state_code)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
            [companyId, branchId, retNumber, original_invoice_id || null, origInvNumber,
             origCustomerId, customer_name || null, rDate,
             JSON.stringify(processedItems), totalAmt, notes || null, rType, req.user.id,
             totalTaxable, totalCGST, totalSGST, totalIGST, totalGST,
             isGSTInvoice, originalInvoiceType, customerStateCode]
        );
        const record = retRow.rows[0];

        // ── Return stock back to branch inventory ────────────────────────────
        for (const item of processedItems) {
            if (item.product_id && item.qty > 0) {
                await client.query(
                    `INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
                     VALUES ($1,$2,$3,$4,NOW())
                     ON CONFLICT (branch_id, product_id)
                     DO UPDATE SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock,
                                   last_updated  = NOW()`,
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

        // Recompute customer outstanding balance after return (best-effort)
        if (origCustomerId) {
            try {
                const balClient = await db.getClient();
                await balClient.query('BEGIN');
                await ensureCustomerLedgerMetadata(balClient, origCustomerId, companyId);
                await recomputeCustomerBalance(balClient, origCustomerId, companyId);
                await balClient.query('COMMIT');
                balClient.release();
            } catch (balErr) {
                console.warn('Balance recompute after return skipped:', balErr.message);
            }
        }

        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sales return error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// ── GET /pending-credits  – unapplied credit notes for a customer ─────────────
router.get('/pending-credits', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { customer_id } = req.query;
    if (!customer_id) return res.json([]);
    try {
        await ensureTable();
        // Returns that have NOT been applied to another invoice (applied_to_invoice_id IS NULL)
        const rows = await db.pgAll(`
            SELECT sr.id, sr.return_number, sr.return_date, sr.total_amount,
                   sr.original_invoice_number, sr.items, sr.refund_type,
                   COALESCE(sr.applied_amount, 0) AS applied_amount,
                   sr.total_amount - COALESCE(sr.applied_amount, 0) AS remaining_credit
            FROM sales_returns sr
            WHERE sr.company_id = $1
              AND sr.customer_id = $2
              AND sr.refund_type = 'CREDIT_NOTE'
              AND (sr.applied_amount IS NULL OR sr.applied_amount < sr.total_amount)
            ORDER BY sr.return_date DESC
        `, [companyId, customer_id]);
        res.json(rows);
    } catch (err) {
        console.error('Pending credits fetch error:', err);
        res.json([]); // return empty on error (table may not exist)
    }
});

// ── GET /customer-history  – all invoices & returns for a customer ────────────
router.get('/customer-history', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { customer_id } = req.query;
    if (!customer_id) return res.json({ invoices: [], totalInvoiced: 0, totalReturned: 0, netBalance: 0 });
    try {
        await ensureTable();
        const invoices = await db.pgAll(`
            SELECT i.id, i.invoice_number, i.invoice_date, i.total_amount,
                   COALESCE(i.return_amount, 0) AS return_amount,
                   i.status, i.paid_amount
            FROM invoices i
            WHERE i.company_id = $1 AND i.customer_id = $2
              AND COALESCE(i.is_deleted, false) = false
              AND i.invoice_type NOT IN ('CREDIT_NOTE')
            ORDER BY i.invoice_date DESC
            LIMIT 50
        `, [companyId, customer_id]);

        const totalInvoiced = invoices.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
        const totalReturned = invoices.reduce((s, r) => s + parseFloat(r.return_amount || 0), 0);
        const netBalance    = totalInvoiced - totalReturned;
        res.json({ invoices, totalInvoiced, totalReturned, netBalance });
    } catch (err) {
        console.error('Customer history error:', err);
        res.json({ invoices: [], totalInvoiced: 0, totalReturned: 0, netBalance: 0 });
    }
});

// ── POST /mark-invoice-cleared/:invoiceId  – mark original invoice as settled ─
router.post('/mark-invoice-cleared/:invoiceId', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { invoiceId } = req.params;
    try {
        const inv = await db.pgGet(
            `SELECT id, total_amount FROM invoices WHERE id = $1 AND company_id = $2`,
            [invoiceId, companyId]
        );
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });
        await db.pgRun(
            `UPDATE invoices SET status = 'PAID', paid_amount = total_amount, updated_at = NOW()
             WHERE id = $1 AND company_id = $2`,
            [invoiceId, companyId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark cleared error:', err);
        res.status(500).json({ error: err.message });
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

// ── PUT /:id  – edit a return ─────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const returnId  = req.params.id;
    const { return_date, items, notes, refund_type } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: 'At least one item required' });

    let client;
    try {
        await ensureTable();
        client = await db.getClient();
        await client.query('BEGIN');

        const oldRes = await client.query(
            `SELECT * FROM sales_returns WHERE id = $1 AND company_id = $2`,
            [returnId, companyId]
        );
        if (!oldRes.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Return not found' });
        }
        const old      = oldRes.rows[0];
        const oldItems = Array.isArray(old.items) ? old.items : JSON.parse(old.items || '[]');
        const oldTotal = parseFloat(old.total_amount);
        const oldType  = old.refund_type;
        const newType  = refund_type || oldType;
        const rDate    = return_date || old.return_date;

        // Re-derive the same GST context stored at creation time (invoice type + buyer
        // state), so editing a return recomputes GST exactly the same way POST / does.
        const isGSTInvoice = isGSTInvoiceType(old.original_invoice_type);
        let isSameState = true;
        if (isGSTInvoice) {
            const companyRow = await client.query(`SELECT state_code FROM companies WHERE id = $1`, [companyId]);
            isSameState = (companyRow.rows[0]?.state_code || '33') === (old.customer_state_code || '33');
        }

        const processedItems = items.map((i) => computeItemTax(i, { isGSTInvoice, isSameState }));
        const totalTaxable = processedItems.reduce((s, i) => s + i.taxable_amount, 0);
        const totalCGST = processedItems.reduce((s, i) => s + i.cgst_amount, 0);
        const totalSGST = processedItems.reduce((s, i) => s + i.sgst_amount, 0);
        const totalIGST = processedItems.reduce((s, i) => s + i.igst_amount, 0);
        const totalGST = processedItems.reduce((s, i) => s + i.total_gst_amount, 0);
        const newTotal = processedItems.reduce((s, i) => s + i.line_total, 0);
        if (newTotal <= 0) throw new Error('Return amount must be > 0');

        // ── Reverse old inventory, apply new ─────────────────────────────────
        for (const item of oldItems) {
            if (item.product_id && item.qty > 0) {
                await client.query(
                    `UPDATE branch_inventory SET current_stock = current_stock - $1, last_updated = NOW()
                     WHERE company_id = $2 AND branch_id = $3 AND product_id = $4`,
                    [item.qty, companyId, branchId, item.product_id]
                );
            }
        }
        for (const item of processedItems) {
            if (item.product_id && item.qty > 0) {
                await client.query(
                    `INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
                     VALUES ($1,$2,$3,$4,NOW())
                     ON CONFLICT (branch_id, product_id)
                     DO UPDATE SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()`,
                    [companyId, branchId, item.product_id, item.qty]
                );
            }
        }

        // ── Reverse old cash/bank entry, create new ───────────────────────────
        if (oldType === 'CASH_REFUND') {
            await client.query(
                `DELETE FROM cash_ledger WHERE company_id=$1 AND branch_id=$2 AND source='SALES_RETURN' AND amount=$3 AND direction='out' AND date=$4`,
                [companyId, branchId, oldTotal, old.return_date]
            );
        } else if (oldType === 'BANK_REFUND') {
            await client.query(
                `DELETE FROM bank_ledger WHERE company_id=$1 AND source='SALES_RETURN' AND transaction_id=$2`,
                [companyId, `RET-${returnId}`]
            );
        }
        if (newType === 'CASH_REFUND') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1,$2,'SALES_RETURN',$3,'out',$4)`,
                [companyId, branchId, newTotal, rDate]
            );
        } else if (newType === 'BANK_REFUND') {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                 VALUES ($1,$2,'SALES_RETURN',$3,'out','Main Account',$4,$5)`,
                [companyId, branchId, newTotal, `RET-${returnId}`, rDate]
            );
        }

        // ── Adjust customer ledger ────────────────────────────────────────────
        if (old.customer_id) {
            await client.query(
                `UPDATE customer_ledger SET debit=$1, date=$2
                 WHERE customer_id=$3 AND company_id=$4 AND type='SALES_RETURN' AND description LIKE $5`,
                [newTotal, rDate, old.customer_id, companyId, `%${old.return_number}%`]
            );
        }

        // ── Adjust invoice return_amount ──────────────────────────────────────
        if (old.original_invoice_id) {
            await client.query(
                `UPDATE invoices SET return_amount = GREATEST(0, COALESCE(return_amount,0) + $1), updated_at=NOW()
                 WHERE id=$2 AND company_id=$3`,
                [newTotal - oldTotal, old.original_invoice_id, companyId]
            );
        }

        // ── Update return record ──────────────────────────────────────────────
        const updated = await client.query(
            `UPDATE sales_returns
             SET return_date=$1, items=$2, total_amount=$3, notes=$4, refund_type=$5, updated_at=NOW(),
                 total_taxable_amount=$6, total_cgst=$7, total_sgst=$8, total_igst=$9, total_gst_amount=$10
             WHERE id=$11 AND company_id=$12 RETURNING *`,
            [rDate, JSON.stringify(processedItems), newTotal, notes || null, newType,
             totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, returnId, companyId]
        );

        await client.query('COMMIT');
        res.json(updated.rows[0]);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sales return update error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// ── DELETE /:id  – delete return with full reversal ──────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const returnId  = req.params.id;

    let client;
    try {
        await ensureTable();
        client = await db.getClient();
        await client.query('BEGIN');

        const oldRes = await client.query(
            `SELECT * FROM sales_returns WHERE id=$1 AND company_id=$2`,
            [returnId, companyId]
        );
        if (!oldRes.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Return not found' });
        }
        const old      = oldRes.rows[0];
        const oldItems = Array.isArray(old.items) ? old.items : JSON.parse(old.items || '[]');
        const oldTotal = parseFloat(old.total_amount);

        // ── Reverse inventory (stock was added on insert, remove it) ─────────
        for (const item of oldItems) {
            if (item.product_id && item.qty > 0) {
                await client.query(
                    `UPDATE branch_inventory SET current_stock = current_stock - $1, last_updated=NOW()
                     WHERE company_id=$2 AND branch_id=$3 AND product_id=$4`,
                    [item.qty, companyId, branchId, item.product_id]
                );
            }
        }

        // ── Reverse cash/bank ledger ──────────────────────────────────────────
        if (old.refund_type === 'CASH_REFUND') {
            await client.query(
                `DELETE FROM cash_ledger WHERE company_id=$1 AND branch_id=$2 AND source='SALES_RETURN' AND amount=$3 AND direction='out' AND date=$4`,
                [companyId, branchId, oldTotal, old.return_date]
            );
        } else if (old.refund_type === 'BANK_REFUND') {
            await client.query(
                `DELETE FROM bank_ledger WHERE company_id=$1 AND source='SALES_RETURN' AND transaction_id=$2`,
                [companyId, `RET-${returnId}`]
            );
        }

        // ── Reverse customer ledger ───────────────────────────────────────────
        if (old.customer_id) {
            await client.query(
                `DELETE FROM customer_ledger WHERE customer_id=$1 AND company_id=$2 AND type='SALES_RETURN' AND description LIKE $3`,
                [old.customer_id, companyId, `%${old.return_number}%`]
            );
        }

        // ── Restore invoice return_amount ─────────────────────────────────────
        if (old.original_invoice_id) {
            await client.query(
                `UPDATE invoices SET return_amount = GREATEST(0, COALESCE(return_amount,0) - $1), updated_at=NOW()
                 WHERE id=$2 AND company_id=$3`,
                [oldTotal, old.original_invoice_id, companyId]
            );
        }

        await client.query(`DELETE FROM sales_returns WHERE id=$1`, [returnId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sales return delete error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
