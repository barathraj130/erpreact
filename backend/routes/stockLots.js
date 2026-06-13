// backend/routes/stockLots.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { triggerN8N } from '../utils/triggerN8N.js';

const router = express.Router();
const OWNER_PHONE = '9787580404';

// ─── Lot number: LOT/YYYY/MM/NNN ─────────────────────────────────────────────
async function generateLotNumber(client, companyId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const padMonth = String(month).padStart(2, '0');

    await client.query(`
        INSERT INTO invoice_number_series (company_id, bill_type, prefix, year, month, last_number)
        VALUES ($1, 'stock_lot', 'LOT', $2, $3, 1)
        ON CONFLICT (company_id, bill_type, year, month)
        DO UPDATE SET last_number = invoice_number_series.last_number + 1
    `, [companyId, year, month]);

    const row = await client.query(`
        SELECT last_number FROM invoice_number_series
        WHERE company_id=$1 AND bill_type='stock_lot' AND year=$2 AND month=$3
    `, [companyId, year, month]);

    const num = String(row.rows[0].last_number).padStart(3, '0');
    return `LOT/${year}/${padMonth}/${num}`;
}

// ─── GET /  ───────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { status } = req.query;
        const params = [companyId];
        let statusClause = '';
        if (status) { params.push(status); statusClause = `AND sl.status = $${params.length}`; }

        const rows = await db.pgAll(`
            SELECT sl.*,
                p.name AS product_name,
                s.name AS supplier_name,
                COALESCE(si_fp.quantity, 0) AS fresh_purchased_qty,
                COALESCE(si_fr.quantity, 0) AS fresh_repaired_qty,
                COALESCE(si_fp.quantity, 0) + COALESCE(si_fr.quantity, 0) AS total_fresh_qty,
                COALESCE(si_m.quantity, 0)  AS mistake_qty_available,
                COALESCE(si_r.quantity, 0)  AS rejected_qty_available,
                COALESCE(si_fp.avg_cost, 0) AS fresh_purchased_avg_cost,
                COALESCE(si_fr.avg_cost, 0) AS fresh_repaired_avg_cost,
                COALESCE(si_m.avg_cost, 0)  AS mistake_avg_cost
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            LEFT JOIN stock_inventory si_fp ON si_fp.lot_id = sl.id AND si_fp.stock_type = 'fresh_purchased'
            LEFT JOIN stock_inventory si_fr ON si_fr.lot_id = sl.id AND si_fr.stock_type = 'fresh_repaired'
            LEFT JOIN stock_inventory si_m  ON si_m.lot_id  = sl.id AND si_m.stock_type  = 'mistake'
            LEFT JOIN stock_inventory si_r  ON si_r.lot_id  = sl.id AND si_r.stock_type  = 'rejected'
            WHERE sl.is_deleted = false AND sl.company_id = $1 ${statusClause}
            ORDER BY sl.purchase_date DESC, sl.id DESC
        `, params);
        res.json(rows);
    } catch (e) {
        console.error('[stockLots GET /]', e.message);
        res.json([]);
    }
});

// ─── GET /pipeline-counts  ────────────────────────────────────────────────────
router.get('/pipeline-counts', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const row = await db.pgGet(`
            SELECT
                COUNT(CASE WHEN status='received'     THEN 1 END) AS received,
                COUNT(CASE WHEN status='inspecting'   THEN 1 END) AS inspecting,
                COUNT(CASE WHEN status='converting'   THEN 1 END) AS converting,
                COUNT(CASE WHEN status='ready'        THEN 1 END) AS ready,
                COUNT(CASE WHEN status='partial_sold' THEN 1 END) AS partial_sold,
                COUNT(CASE WHEN status='sold_out'     THEN 1 END) AS sold_out,
                COUNT(CASE WHEN status='closed'       THEN 1 END) AS closed
            FROM stock_lots
            WHERE is_deleted = false AND company_id = $1
        `, [companyId]);
        res.json(row);
    } catch (e) {
        console.error('[stockLots pipeline-counts]', e.message);
        res.json({});
    }
});

// ─── GET /:id  ────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const lot = await db.pgGet(`
            SELECT sl.*,
                p.name AS product_name,
                s.name AS supplier_name
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            WHERE sl.id = $1 AND sl.company_id = $2 AND sl.is_deleted = false
        `, [req.params.id, companyId]);
        if (!lot) return res.status(404).json({ error: 'Lot not found' });

        const inventory = await db.pgAll(
            `SELECT * FROM stock_inventory WHERE lot_id = $1 ORDER BY stock_type`,
            [req.params.id]
        );
        res.json({ ...lot, inventory });
    } catch (e) {
        console.error('[stockLots GET /:id]', e.message);
        res.json({ error: e.message });
    }
});

// ─── GET /:id/purchases  ─────────────────────────────────────────────────────
router.get('/:id/purchases', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM purchase_bills WHERE lot_id = $1 ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /:id/inspections  ───────────────────────────────────────────────────
router.get('/:id/inspections', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM stock_lot_inspections WHERE lot_id = $1 ORDER BY inspection_date DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /:id/conversions  ───────────────────────────────────────────────────
router.get('/:id/conversions', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM stock_conversions WHERE lot_id = $1 ORDER BY conversion_date DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /:id/sales  ─────────────────────────────────────────────────────────
router.get('/:id/sales', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(`
            SELECT
                i.invoice_number, i.invoice_date,
                COALESCE(u.username, i.walk_in_name, 'Walk-in') AS customer_name,
                ili.stock_type, ili.quantity, ili.unit_price,
                (ili.quantity * ili.unit_price) AS revenue,
                COALESCE(ili.profit_per_piece, 0) AS profit_per_piece,
                COALESCE(ili.total_profit, 0) AS total_profit,
                ili.avg_cost
            FROM invoice_line_items ili
            JOIN invoices i ON i.id = ili.invoice_id
            LEFT JOIN users u ON u.id = i.customer_id
            WHERE ili.lot_id = $1
            ORDER BY i.invoice_date DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /:id/transactions  ──────────────────────────────────────────────────
router.get('/:id/transactions', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM stock_transactions WHERE lot_id = $1 ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /:id/profit  ────────────────────────────────────────────────────────
router.get('/:id/profit', authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const lot = await db.pgGet(`SELECT * FROM stock_lots WHERE id = $1`, [id]);
        if (!lot) return res.json({ error: 'Lot not found' });

        const inv = await db.pgAll(`SELECT * FROM stock_inventory WHERE lot_id = $1`, [id]);
        const invMap = Object.fromEntries(inv.map(r => [r.stock_type, r]));

        const salesRow = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN ili.stock_type IN ('fresh_purchased','fresh_repaired') THEN ili.quantity * ili.unit_price ELSE 0 END), 0) AS fresh_revenue,
                COALESCE(SUM(CASE WHEN ili.stock_type = 'mistake' THEN ili.quantity * ili.unit_price ELSE 0 END), 0) AS mistake_revenue,
                COALESCE(SUM(ili.quantity * ili.unit_price), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN ili.stock_type IN ('fresh_purchased','fresh_repaired') THEN ili.quantity ELSE 0 END), 0) AS fresh_qty_sold,
                COALESCE(SUM(CASE WHEN ili.stock_type = 'mistake' THEN ili.quantity ELSE 0 END), 0) AS mistake_qty_sold,
                COALESCE(SUM(ili.total_profit), 0) AS gross_profit
            FROM invoice_line_items ili
            WHERE ili.lot_id = $1
        `, [id]);

        const freshPurchaseCost   = parseFloat(lot.fresh_purchase_cost)   || 0;
        const mistakePurchaseCost = parseFloat(lot.mistake_purchase_cost) || 0;
        const transportCost       = parseFloat(lot.transport_cost)        || 0;
        const totalRepairCost     = parseFloat(lot.total_repair_cost)     || 0;
        const totalPurchaseCost   = freshPurchaseCost + mistakePurchaseCost + transportCost;
        const totalCost           = totalPurchaseCost + totalRepairCost;
        const totalRevenue        = parseFloat(salesRow.total_revenue) || 0;
        const grossProfit         = totalRevenue - totalCost;
        const profitMargin        = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const mistakePurchased    = parseInt(lot.mistake_qty_purchased) || 0;
        const repairedQty         = parseInt(lot.repaired_qty) || 0;
        const conversionEfficiency = mistakePurchased > 0 ? (repairedQty / mistakePurchased) * 100 : 0;
        const repairCostPerPiece  = repairedQty > 0 ? totalRepairCost / repairedQty : 0;

        res.json({
            lot,
            inventory: invMap,
            fresh_purchase_cost:   freshPurchaseCost,
            mistake_purchase_cost: mistakePurchaseCost,
            transport_cost:        transportCost,
            total_purchase_cost:   totalPurchaseCost,
            total_repair_cost:     totalRepairCost,
            total_cost:            totalCost,
            fresh_revenue:         parseFloat(salesRow.fresh_revenue),
            mistake_revenue:       parseFloat(salesRow.mistake_revenue),
            total_revenue:         totalRevenue,
            gross_profit:          grossProfit,
            profit_margin:         profitMargin,
            conversion_efficiency: conversionEfficiency,
            repair_cost_per_piece: repairCostPerPiece,
            fresh_qty_sold:        parseInt(salesRow.fresh_qty_sold),
            mistake_qty_sold:      parseInt(salesRow.mistake_qty_sold),
        });
    } catch (e) {
        console.error('[stockLots profit]', e.message);
        res.json({ error: e.message });
    }
});

// ─── POST /  — Create new lot ─────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const { supplier_id, product_id, purchase_date, notes } = req.body;

        const lot_number = await generateLotNumber(client, companyId);

        const result = await client.query(`
            INSERT INTO stock_lots (company_id, lot_number, supplier_id, product_id, purchase_date, notes)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [companyId, lot_number, supplier_id || null, product_id || null, purchase_date || new Date(), notes || null]);

        await client.query('COMMIT');
        res.json({ success: true, lot: result.rows[0] });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[stockLots POST]', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── PUT /:id  — Update lot metadata ─────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { supplier_id, product_id, purchase_date, status, notes } = req.body;
        await db.pgRun(`
            UPDATE stock_lots SET
                supplier_id = COALESCE($1, supplier_id),
                product_id  = COALESCE($2, product_id),
                purchase_date = COALESCE($3, purchase_date),
                status = COALESCE($4, status),
                notes  = COALESCE($5, notes),
                updated_at = NOW()
            WHERE id = $6 AND company_id = $7 AND is_deleted = false
        `, [supplier_id, product_id, purchase_date, status, notes, req.params.id, companyId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[stockLots PUT]', e.message);
        res.json({ success: false, error: e.message });
    }
});

// ─── DELETE /:id  — Soft delete ───────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        await db.pgRun(
            `UPDATE stock_lots SET is_deleted = true, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
            [req.params.id, companyId]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ─── POST /:id/purchase  ─────────────────────────────────────────────────────
router.post('/:id/purchase', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const lotId = req.params.id;
        const companyId = req.user.active_company_id;
        const {
            fresh_qty, mistake_qty, fresh_rate, mistake_rate,
            transport_cost, payment_mode, paid_amount, bill_number
        } = req.body;

        const lotRes = await client.query(
            `SELECT * FROM stock_lots WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
            [lotId, companyId]
        );
        const lot = lotRes.rows[0];
        if (!lot) throw new Error('Lot not found');

        const freshQty   = parseInt(fresh_qty)   || 0;
        const mistakeQty = parseInt(mistake_qty) || 0;
        const freshRate  = parseFloat(fresh_rate)  || 0;
        const mistakeRate = parseFloat(mistake_rate) || 0;
        const transport  = parseFloat(transport_cost) || 0;
        const freshCost   = freshQty * freshRate;
        const mistakeCost = mistakeQty * mistakeRate;
        const totalCost   = freshCost + mistakeCost + transport;
        const paid        = parseFloat(paid_amount) || 0;
        const balance     = totalCost - paid;
        const status      = balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

        // Insert purchase bill
        await client.query(`
            INSERT INTO purchase_bills
                (company_id, lot_id, supplier_id, purchase_number, total_amount, paid_amount,
                 balance_amount, fresh_qty, mistake_qty, fresh_rate, mistake_rate,
                 transport_cost, payment_mode, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `, [companyId, lotId, lot.supplier_id, bill_number || null,
            totalCost, paid, balance,
            freshQty, mistakeQty, freshRate, mistakeRate,
            transport, payment_mode || 'cash', status]);

        // Update lot totals
        await client.query(`
            UPDATE stock_lots SET
                fresh_qty_purchased  = fresh_qty_purchased  + $1,
                mistake_qty_purchased= mistake_qty_purchased+ $2,
                fresh_purchase_rate  = CASE WHEN fresh_qty_purchased + $1 > 0
                    THEN (fresh_purchase_cost + $3) / (fresh_qty_purchased + $1) ELSE fresh_purchase_rate END,
                mistake_purchase_rate= CASE WHEN mistake_qty_purchased + $2 > 0
                    THEN (mistake_purchase_cost + $4) / (mistake_qty_purchased + $2) ELSE mistake_purchase_rate END,
                fresh_purchase_cost  = fresh_purchase_cost  + $3,
                mistake_purchase_cost= mistake_purchase_cost+ $4,
                total_purchase_cost  = total_purchase_cost  + $5,
                transport_cost       = transport_cost       + $6,
                fresh_qty_current    = fresh_qty_current    + $1,
                mistake_qty_current  = mistake_qty_current  + $2,
                status = CASE WHEN status = 'received' THEN 'received' ELSE status END,
                updated_at = NOW()
            WHERE id = $7
        `, [freshQty, mistakeQty, freshCost, mistakeCost, totalCost, transport, lotId]);

        // UPSERT inventory — fresh
        if (freshQty > 0) {
            await client.query(`
                INSERT INTO stock_inventory (lot_id, product_id, stock_type, quantity, avg_cost, total_cost)
                VALUES ($1, $2, 'fresh_purchased', $3, $4, $5)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity   = stock_inventory.quantity   + $3,
                    total_cost = stock_inventory.total_cost + $5,
                    avg_cost   = (stock_inventory.total_cost + $5) / NULLIF(stock_inventory.quantity + $3, 0),
                    last_updated = NOW()
            `, [lotId, lot.product_id, freshQty, freshRate, freshCost]);
        }

        // UPSERT inventory — mistake
        if (mistakeQty > 0) {
            await client.query(`
                INSERT INTO stock_inventory (lot_id, product_id, stock_type, quantity, avg_cost, total_cost)
                VALUES ($1, $2, 'mistake', $3, $4, $5)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity   = stock_inventory.quantity   + $3,
                    total_cost = stock_inventory.total_cost + $5,
                    avg_cost   = (stock_inventory.total_cost + $5) / NULLIF(stock_inventory.quantity + $3, 0),
                    last_updated = NOW()
            `, [lotId, lot.product_id, mistakeQty, mistakeRate, mistakeCost]);
        }

        // Transactions log
        if (freshQty > 0) {
            await client.query(`
                INSERT INTO stock_transactions (lot_id, product_id, transaction_type, stock_type_to, quantity, rate, amount, notes)
                VALUES ($1, $2, 'purchase', 'fresh_purchased', $3, $4, $5, 'Fresh stock purchased')
            `, [lotId, lot.product_id, freshQty, freshRate, freshCost]);
        }
        if (mistakeQty > 0) {
            await client.query(`
                INSERT INTO stock_transactions (lot_id, product_id, transaction_type, stock_type_to, quantity, rate, amount, notes)
                VALUES ($1, $2, 'purchase', 'mistake', $3, $4, $5, 'Mistake stock purchased')
            `, [lotId, lot.product_id, mistakeQty, mistakeRate, mistakeCost]);
        }

        // Ledger entries
        if (freshCost > 0) {
            await client.query(`
                INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
                VALUES ($1, 'Inventory - Fresh Stock', $2, 0, $3, 'stock_purchase', $4, CURRENT_DATE)
            `, [companyId, freshCost, `Fresh stock lot ${lot.lot_number}`, payment_mode || 'credit']);
        }
        if (mistakeCost > 0) {
            await client.query(`
                INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
                VALUES ($1, 'Inventory - Mistake Stock', $2, 0, $3, 'stock_purchase', $4, CURRENT_DATE)
            `, [companyId, mistakeCost, `Mistake stock lot ${lot.lot_number}`, payment_mode || 'credit']);
        }
        await client.query(`
            INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
            VALUES ($1, 'Supplier Payable', 0, $2, $3, 'stock_purchase', $4, CURRENT_DATE)
        `, [companyId, totalCost, `Purchase lot ${lot.lot_number}`, payment_mode || 'credit']);

        if (paid > 0) {
            const accountName = payment_mode === 'bank' ? 'Bank Account' : 'Cash Account';
            await client.query(`
                INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
                VALUES
                    ($1, 'Supplier Payable', $2, 0, $3, 'stock_purchase_payment', $4, CURRENT_DATE),
                    ($1, $5, 0, $2, $3, 'stock_purchase_payment', $4, CURRENT_DATE)
            `, [companyId, paid, `Payment for lot ${lot.lot_number}`, payment_mode || 'cash', accountName]);
        }

        await client.query('COMMIT');

        // WhatsApp after COMMIT
        triggerN8N('whatsapp-send', {
            phone: OWNER_PHONE,
            message: `LOT ${lot.lot_number} PURCHASED\nFresh: ${freshQty} pcs @ ₹${freshRate}\nMistake: ${mistakeQty} pcs @ ₹${mistakeRate}\nTotal: ₹${totalCost.toFixed(2)}`
        });

        res.json({ success: true, message: `Purchase recorded for lot ${lot.lot_number}` });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[stockLots purchase]', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── POST /:id/close  ────────────────────────────────────────────────────────
router.post('/:id/close', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        await db.pgRun(
            `UPDATE stock_lots SET status = 'closed', updated_at = NOW() WHERE id = $1 AND company_id = $2`,
            [req.params.id, companyId]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

export default router;
